/**
 * services/mahak/order.service.js — site order → Mahak sales invoice.
 *
 * When: after the money is confirmed — online payment verified, a bank receipt
 * approved in full, or an instalment order confirmed by the admin. The callers
 * are those three routes; they call queueMahakInvoice(), which never throws.
 *
 * An order whose lines belong to two Mahak accounts becomes two invoices, one
 * per account, each with that account's visitorId and its own number.
 *
 * The invoice number (orderClientId) is taken from a per-account sequence and
 * stored on the order BEFORE anything is sent, so a retry sends the same
 * number again instead of creating a second invoice.
 */
import Order from "base/models/Order";
import "base/models/User";
import { MahakAccount, MahakLink } from "base/models/Mahak";
import { MAHAK } from "@/lib/mahak/config";
import { saveAll } from "@/lib/mahak/client";
import { allocate, buildInvoicePayload, saveErrors } from "@/lib/mahak/mapping";
import { mahakEnabled } from "base/services/mahak/sync.service";

async function nextOrderNumber(account) {
  // first use starts at the current epoch second, so numbers stay unique even
  // if the site database is ever rebuilt
  const seed = Math.floor(Date.now() / 1000);
  const doc = await MahakAccount.findOneAndUpdate(
    { key: account },
    [{ $set: { orderSeq: { $add: [{ $ifNull: ["$orderSeq", seed] }, 1] } } }],
    { returnDocument: "after", upsert: true, updatePipeline: true },
  ).lean();
  return doc.orderSeq;
}

/** Order lines grouped by the Mahak account that owns them. */
async function linesByAccount(order) {
  const items = (order.items || []).filter((i) => i.itemType !== "used_product" && (i.variant || i.product));
  const links = await MahakLink.find({
    $or: [
      { variant: { $in: items.filter((i) => i.variant).map((i) => i.variant) } },
      { product: { $in: items.filter((i) => !i.variant).map((i) => i.product) }, variant: null },
    ],
  }).lean();
  const byVariant = new Map(links.filter((l) => l.variant).map((l) => [String(l.variant), l]));
  const byProduct = new Map(links.filter((l) => !l.variant).map((l) => [String(l.product), l]));
  const groups = new Map();
  let allLinesTotal = 0;
  for (const item of items) {
    allLinesTotal += item.unitPrice * item.quantity;
    const link = item.variant ? byVariant.get(String(item.variant)) : byProduct.get(String(item.product));
    if (!link) continue;
    if (!groups.has(link.account)) groups.set(link.account, []);
    groups.get(link.account).push({
      productDetailId: link.productDetailId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
  }
  return { groups, allLinesTotal };
}

/**
 * Post (or finish posting) the invoices of one order.
 * @returns {{ state: "done"|"failed"|"skipped", error?: string }}
 */
export async function postOrderInvoices(orderId) {
  const order = await Order.findById(orderId).select("+mahak").populate("user", "name lastName phone").lean();
  if (!order) return { state: "skipped", error: "سفارش یافت نشد" };
  if (order.fulfillmentStatus === "CANCELED") return { state: "skipped", error: "سفارش لغو شده است" };
  if (order.mahak?.state === "done") return { state: "done" };

  const { groups, allLinesTotal } = await linesByAccount(order);
  if (!groups.size) return { state: "skipped", error: "این سفارش کالای محک ندارد" };

  const mahak = {
    state: "pending",
    queuedAt: order.mahak?.queuedAt || new Date(),
    doneAt: null,
    error: "",
    invoices: [...(order.mahak?.invoices || [])],
  };
  for (const account of groups.keys()) {
    if (!mahak.invoices.some((i) => i.account === account)) {
      mahak.invoices.push({ account, orderClientId: await nextOrderNumber(account), orderId: null, postedAt: null, error: "" });
    }
  }
  await Order.updateOne({ _id: order._id }, { $set: { mahak } });

  // order-level discount (coupon / manual), shared out by each account's subtotal
  const accounts = [...groups.keys()];
  const subtotals = accounts.map((a) => groups.get(a).reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const orderDiscount = Math.max(0, Math.round(allLinesTotal - order.totalPrice));
  const rest = Math.max(0, allLinesTotal - subtotals.reduce((s, v) => s + v, 0));
  const discounts = allocate(orderDiscount, [...subtotals, rest]);

  const phone = String(order.user?.phone || order.address?.snapshot?.phone || "").replace(/\D/g, "");
  const person = {
    firstName: order.user?.name || order.address?.snapshot?.fullName || "مشتری سایت",
    lastName: order.user?.lastName || "",
    mobile: phone,
  };
  // stable per customer: the mobile number, else the creation second of the user id
  const personClientId = Number(phone.replace(/^0+/, "")) || parseInt(String(order.user?._id || order._id).slice(0, 8), 16);

  for (const [i, account] of accounts.entries()) {
    const invoice = mahak.invoices.find((inv) => inv.account === account);
    if (invoice.postedAt) continue;
    try {
      const { objects } = await saveAll(account, (session) =>
        buildInvoicePayload({
          order,
          lines: groups.get(account),
          ids: { orderClientId: invoice.orderClientId, personClientId, visitorId: session.visitorId },
          person,
          discount: discounts[i],
          multiplier: MAHAK.priceDivisor,
          orderType: MAHAK.orderType,
        }),
      );
      const problem = saveErrors(objects);
      if (problem) throw new Error(problem);
      invoice.orderId = objects.orders?.results?.[0]?.entityId ?? null;
      invoice.postedAt = new Date();
      invoice.error = "";
    } catch (err) {
      invoice.error = String(err?.message || err).slice(0, 500);
    }
  }

  const failed = mahak.invoices.filter((inv) => !inv.postedAt);
  mahak.state = failed.length ? "failed" : "done";
  mahak.doneAt = failed.length ? null : new Date();
  mahak.error = failed.map((inv) => `${inv.account}: ${inv.error}`).join(" | ");
  await Order.updateOne({ _id: order._id }, { $set: { mahak } });
  return { state: mahak.state, error: mahak.error };
}

/** For the payment routes: fire and never fail the request that confirmed the money. */
export async function queueMahakInvoice(orderId) {
  if (!mahakEnabled()) return;
  try {
    const result = await postOrderInvoices(orderId);
    if (result.state === "failed") console.error(`[mahak] invoice of order ${orderId} failed: ${result.error}`);
  } catch (err) {
    console.error(`[mahak] invoice of order ${orderId} crashed:`, err);
    await Order.updateOne(
      { _id: orderId },
      { $set: { "mahak.state": "failed", "mahak.error": String(err?.message || err).slice(0, 500) } },
    ).catch(() => {});
  }
}

/** Hourly: invoices that did not go through (Mahak down, bad row, …). */
export async function retryMahakInvoices({ limit = 20 } = {}) {
  if (!mahakEnabled()) return { retried: 0, done: 0 };
  const orders = await Order.find({ "mahak.state": { $in: ["pending", "failed"] } })
    .select("_id")
    .sort({ "mahak.queuedAt": 1 })
    .limit(limit)
    .lean();
  let done = 0;
  for (const o of orders) {
    const result = await postOrderInvoices(o._id).catch(() => null);
    if (result?.state === "done") done++;
  }
  return { retried: orders.length, done };
}
