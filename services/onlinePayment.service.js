/**
 * services/onlinePayment.service.js — card payment through the gateway.
 *
 *   checkout        order (UNPAID, stock reserved) + Payment PENDING → startOnlinePayment → gateway URL
 *   gateway return  handleGatewayReturn: verify with the gateway → Payment PAID → confirmOrderPaid
 *   abandoned       expireUnpaidOnlineOrders: cancelled after ONLINE_ORDER_TTL_MIN, stock released
 *
 * Money is only ever marked as received after the gateway's verify says so;
 * nothing a browser sends can mark an order paid.
 */
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import UsedProduct from "base/models/UsedProduct";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";
import { notifyNewOrder, notifyNewPayment } from "base/services/notificationService";
import { releaseOrderStock } from "base/services/inventory.service";
import { queueMahakInvoice } from "base/services/mahak/order.service";
import { sendOrderConfirmationEmail } from "@/lib/emailService";
import { markOrderUsedProductsSold } from "@/lib/usedProductOrderStatus";
import { requestPayment, verifyPayment } from "base/services/payments/zarinpal";
import { isFeatureEnabled } from "@/lib/features";
import { inquire as inquireRoz } from "base/services/payments/rozpardakht";

// The gateway's own authority expires well before this.
export const ONLINE_ORDER_TTL_MIN = 30;

const siteUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/** Create the pending payment of a just-created online order and get the gateway URL. */
export async function startOnlinePayment(order, { mobile = "", email = "" } = {}) {
  const payment = await Payment.create({
    order: order._id,
    method: "ONLINE",
    amount: order.totalPrice,
    status: "PENDING",
    onlinePayment: { gateway: process.env.ZARINPAL_SANDBOX === "1" ? "zarinpal-sandbox" : "zarinpal" },
  });
  await Order.updateOne({ _id: order._id }, { $push: { payments: payment._id } });
  const { authority, url } = await requestPayment({
    amountToman: order.totalPrice,
    callbackUrl: `${siteUrl()}/api/payments/online/callback?orderId=${order._id}`,
    description: `سفارش ${order.trackingCode}`,
    mobile,
    email,
  });
  await Payment.updateOne({ _id: payment._id }, { $set: { "onlinePayment.authority": authority } });
  return { url, payment };
}

/**
 * The order's money is in: mark it paid, start processing, and everything that
 * follows a confirmed payment (used products, notifications,
 * email, Mahak invoice). Idempotent.
 */
export async function confirmOrderPaid(orderId) {
  let changed = false;
  await runWithOptionalTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order || order.fulfillmentStatus === "CANCELED" || order.paymentStatus === "PAID") return;
    const paid = await Payment.find({ order: order._id, status: "PAID" }).session(session).lean();
    if (paid.reduce((sum, p) => sum + p.amount, 0) < order.totalPrice) return;
    order.paymentStatus = "PAID";
    if (["WAITING", "NEEDS_PURCHASE"].includes(order.fulfillmentStatus)) order.fulfillmentStatus = "PROCESSING";
    await order.save({ session });
    changed = true;
  });
  if (!changed) return false;

  const order = await Order.findById(orderId)
    .populate("items.product", "_id name mainImage")
    .populate("items.variant", "_id attributes images sku")
    .populate("items.flowSelections.selectedProduct", "_id name mainImage")
    .populate("user", "_id email")
    .lean();
  await markOrderUsedProductsSold(order);
  for (const step of [
    () => notifyNewOrder(order),
    () => notifyNewPayment(order),
    () => sendOrderConfirmationEmail(order, order.user?.email ?? null),
    () => queueMahakInvoice(order._id),
  ]) {
    try {
      await step();
    } catch (err) {
      console.error("[online-payment] after-payment step failed:", err?.message);
    }
  }
  return true;
}

/**
 * The browser came back from the gateway (GET …/callback?orderId&Authority&Status).
 * @returns { status: "paid" | "failed" | "expired" | "invalid", trackingCode? }
 */
export async function handleGatewayReturn({ orderId, authority, status }) {
  if (!orderId || !authority || !/^[0-9a-f]{24}$/i.test(String(orderId))) return { status: "invalid" };
  const order = await Order.findById(orderId).select("trackingCode totalPrice paymentStatus fulfillmentStatus").lean();
  if (!order) return { status: "invalid" };
  const payment = await Payment.findOne({ order: order._id, method: "ONLINE", "onlinePayment.authority": authority });
  if (!payment) return { status: "invalid" };
  const result = (s) => ({ status: s, trackingCode: order.trackingCode });

  if (payment.status === "PAID") {
    await confirmOrderPaid(order._id); // a repeated return after a crash finishes the job
    return result("paid");
  }
  // Never verify for an order that was cancelled meanwhile (expired): an
  // unverified transaction is returned to the customer by the gateway.
  if (order.fulfillmentStatus === "CANCELED") {
    await Payment.updateOne({ _id: payment._id, status: "PENDING" }, { $set: { status: "FAILED" } });
    return result(status === "OK" ? "expired" : "failed");
  }
  if (payment.status !== "PENDING") return result("failed");
  if (status !== "OK") {
    await Payment.updateOne({ _id: payment._id, status: "PENDING" }, { $set: { status: "FAILED" } });
    return result("failed");
  }

  const verified = await verifyPayment({ amountToman: payment.amount, authority });
  if (!verified.ok) {
    await Payment.updateOne(
      { _id: payment._id, status: "PENDING" },
      { $set: { status: "FAILED", meta: { gatewayCode: verified.code } } },
    );
    return result("failed");
  }
  await Payment.updateOne(
    { _id: payment._id, status: "PENDING" },
    {
      $set: {
        status: "PAID",
        "onlinePayment.refId": verified.refId,
        "onlinePayment.paidAt": new Date(),
        meta: { cardPan: verified.cardPan, gatewayCode: verified.code },
      },
    },
  );
  await confirmOrderPaid(order._id);
  return result("paid");
}

/**
 * Online / RozPardakht orders nobody paid for: cancel them and give their stock
 * and used products back. Safe to run often (checkout calls it, and the hourly cron).
 *
 * A RozPardakht order whose confirm call was sent (its answer may have been
 * lost) is asked about first — at most one inquiry per run, since RozPardakht
 * allows one every 30 s — and kept if it was paid.
 */
export async function expireUnpaidOnlineOrders({ olderThanMin = ONLINE_ORDER_TTL_MIN } = {}) {
  const before = new Date(Date.now() - olderThanMin * 60000);
  const stale = await Order.find({
    paymentMethod: { $in: ["ONLINE", "ROZPARDAKHT"] },
    paymentStatus: "UNPAID",
    fulfillmentStatus: "WAITING",
    createdAt: { $lt: before },
  })
    .select("_id")
    .limit(100)
    .lean();
  let expired = 0;
  let inquired = false;
  for (const { _id } of stale) {
    // a payment verified in the meantime keeps the order
    if (await Payment.exists({ order: _id, status: "PAID" })) continue;
    const uncertain = await Payment.findOne({
      order: _id, method: "ROZPARDAKHT", status: "PENDING", "meta.roz.confirmAttemptedAt": { $ne: null },
    }).lean();
    if (uncertain) {
      if (inquired) continue; // next run
      inquired = true;
      try {
        await inquireRoz(uncertain.meta.roz);
        await markRozPaid(uncertain._id, null);
        await confirmOrderPaid(_id);
        continue;
      } catch (err) {
        if (err?.code !== "-32") continue; // unknown: never cancel a payment that may have gone through
      }
    }
    if (await cancelUnpaidOrder(_id)) expired++;
  }
  return expired;
}

/** RozPardakht confirmed the payment: PAID with its invoice number. */
export async function markRozPaid(paymentId, invoice) {
  await Payment.updateOne(
    { _id: paymentId, status: "PENDING" },
    { $set: { status: "PAID", "onlinePayment.refId": invoice, "onlinePayment.paidAt": new Date() } },
  );
}

/** Cancel an unpaid order, give its stock and used products back. false if it was no longer unpaid. */
export async function cancelUnpaidOrder(_id) {
  const order = await Order.findOneAndUpdate(
    { _id, paymentStatus: "UNPAID", fulfillmentStatus: "WAITING" },
    { $set: { fulfillmentStatus: "CANCELED", inventoryReserved: false } },
    { returnDocument: "before" },
  ).lean();
  if (!order) return false;
  if (order.inventoryReserved) await releaseOrderStock(order.items);
  await UsedProduct.updateMany({ order: _id, status: "reserved" }, { $set: { status: "available", order: null } });
  await Payment.updateMany({ order: _id, status: "PENDING" }, { $set: { status: "FAILED" } });
  return true;
}
