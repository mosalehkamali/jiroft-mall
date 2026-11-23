// npm test -- rozPayment
//
// RozPardakht end to end against a real replica set, with its web API replaced
// by a fake that follows the 3.2.6 contract (pay → ok, verifypassword → token,
// confirmpayment → invoice no., inquiry, cancelpayment; errors as a negative
// number with status 406).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register("./productCreationHooks.mjs", import.meta.url);

process.env.ROZPARDAKHT_USERNAME = "shopuser";
process.env.ROZPARDAKHT_PASSWORD = "secret";
process.env.ROZPARDAKHT_SHOP_ID = "77";

const OTP = "12345";
const roz = { calls: [], credit: Infinity, paid: new Set(), down: false };
globalThis.fetch = async (url) => {
  if (roz.down) throw new TypeError("fetch failed");
  const [, fn, raw] = url.match(/\/api\/payment\/([a-z]+)\/(.+)$/);
  const key = decodeURIComponent(raw);
  roz.calls.push({ fn, key });
  const text = (s, status = 200) => new Response(JSON.stringify(s), { status });
  const err = (c) => text(c, 406);
  const [user, pass, orderId, , price, shop] = key.split("-");
  if (user !== "shopuser" || pass !== "secret") return err("-25");
  if (shop !== "77") return err("-15");
  const base = key.split("-").slice(0, 7).join("-");
  if (fn === "pay") return Number(price) > roz.credit ? err("-1") : text("ok");
  if (fn === "verifypassword") return key.split("-")[7] === OTP ? text(`TOKEN${orderId}`) : err("-16");
  if (fn === "confirmpayment") {
    if (roz.paid.has(base)) return err("-3");
    roz.paid.add(base);
    return text("9001");
  }
  if (fn === "inquiry") return roz.paid.has(base) ? text("ok") : err("-32");
  if (fn === "cancelpayment") return roz.paid.delete(base) ? text("ok") : err("-36");
  return new Response("", { status: 404 });
};

let repl, Order, Payment, Product, svc, online, client, product;
const user = new mongoose.Types.ObjectId();

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import("../models/registerModels.js");
  Order = mongoose.model("Order");
  Payment = mongoose.model("Payment");
  Product = mongoose.model("Product");
  await Promise.all([Order.init(), Product.init()]);
  svc = await import("../services/rozPayment.service.js");
  online = await import("../services/onlinePayment.service.js");
  client = await import("../services/payments/rozpardakht.js");
  product = await Product.create({ name: "کفش", sku: "R1", basePrice: 1000, stock: 10 });
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

/** What checkout does for ROZPARDAKHT. */
async function checkout(qty = 1) {
  await Product.updateOne({ _id: product._id }, { $inc: { stock: -qty } });
  const order = await Order.create({
    user,
    items: [{ product: product._id, quantity: qty, unitPrice: 150000 }],
    subtotalPrice: 150000 * qty,
    totalPrice: 150000 * qty,
    paymentMethod: "ROZPARDAKHT",
    inventoryReserved: true,
  });
  await svc.startRozPayment(order, "0499370899");
  return order;
}
const stock = async () => (await Product.findById(product._id).lean()).stock;

test("helpers: national id checksum, Jalali Tehran datetime", () => {
  assert.ok(client.isValidNationalCode("0499370899"));
  assert.ok(client.isValidNationalCode("۰۴۹۹۳۷۰۸۹۹"));
  assert.ok(!client.isValidNationalCode("0499370898"));
  assert.ok(!client.isValidNationalCode("1111111111"));
  assert.equal(client.rozDatetime(new Date("2026-11-23T20:05:00Z")), "1405;09;02;23;35");
});

test("start: key in Rial with the shop's parts; password never stored", async () => {
  const order = await checkout();
  const { key } = roz.calls.at(-1);
  assert.equal(roz.calls.at(-1).fn, "pay");
  assert.match(key, new RegExp(`^shopuser-secret-${order.trackingCode}-0499370899-1500000-77-\\d{4};\\d\\d;\\d\\d;\\d\\d;\\d\\d$`));
  const payment = await Payment.findOne({ order: order._id }).lean();
  assert.equal(payment.method, "ROZPARDAKHT");
  assert.ok(!JSON.stringify(payment).includes("secret"));
});

test("wrong code can be retried; right code pays the order once", async () => {
  const order = await checkout(2);
  await assert.rejects(svc.confirmRozPayment({ orderId: order._id, userId: user, code: "99999" }), /صحیح نیست/);
  assert.equal((await Payment.findOne({ order: order._id }).lean()).status, "PENDING");

  // someone else's order
  await assert.rejects(svc.confirmRozPayment({ orderId: order._id, userId: new mongoose.Types.ObjectId(), code: OTP }), /یافت نشد/);

  const result = await svc.confirmRozPayment({ orderId: order._id, userId: user, code: OTP });
  assert.deepEqual(result, { status: "paid", trackingCode: order.trackingCode });
  const paid = await Order.findById(order._id).lean();
  assert.equal(paid.paymentStatus, "PAID");
  assert.equal(paid.fulfillmentStatus, "PROCESSING");
  assert.equal((await Payment.findOne({ order: order._id }).lean()).onlinePayment.refId, "9001");

  const confirms = roz.calls.filter((c) => c.fn === "confirmpayment").length;
  await svc.confirmRozPayment({ orderId: order._id, userId: user, code: OTP });
  assert.equal(roz.calls.filter((c) => c.fn === "confirmpayment").length, confirms, "a paid order is not confirmed again");
});

test("no credit: pay throws, so checkout can delete the order", async () => {
  roz.credit = 100;
  const order = await Order.create({ user, items: [], subtotalPrice: 150000, totalPrice: 150000, paymentMethod: "ROZPARDAKHT" });
  await assert.rejects(svc.startRozPayment(order, "0499370899"), (e) => e.name === "GatewayError" && /کافی نیست/.test(e.message));
  roz.credit = Infinity;
});

test("a lost confirm answer: expiry asks first and keeps a paid order, cancels an unpaid one", async () => {
  const paidOrder = await checkout();
  const unpaidOrder = await checkout();
  const before = await stock();

  // confirm reached RozPardakht but the answer got lost
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    if (url.includes("/confirmpayment/")) throw new TypeError("fetch failed");
    return res;
  };
  await assert.rejects(svc.confirmRozPayment({ orderId: paidOrder._id, userId: user, code: OTP }), /دوباره پرداخت نکنید/);
  globalThis.fetch = realFetch;
  assert.equal((await Order.findById(paidOrder._id).lean()).paymentStatus, "UNPAID");

  await Order.collection.updateMany({ _id: { $in: [paidOrder._id, unpaidOrder._id] } }, { $set: { createdAt: new Date(Date.now() - 3600e3) } });
  await online.expireUnpaidOnlineOrders();
  assert.equal((await Order.findById(paidOrder._id).lean()).paymentStatus, "PAID");
  assert.equal((await Order.findById(unpaidOrder._id).lean()).fulfillmentStatus, "CANCELED");
  assert.equal(await stock(), before + 1);
});

test("a dead payment cancels the order and gives the stock back", async () => {
  const order = await checkout();
  const before = await stock();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => (url.includes("/confirmpayment/") ? new Response('"-18"', { status: 406 }) : realFetch(url, init));
  await assert.rejects(svc.confirmRozPayment({ orderId: order._id, userId: user, code: OTP }), (e) => e.status === 409 && /منقضی|تمام شده/.test(e.message));
  globalThis.fetch = realFetch;
  assert.equal((await Order.findById(order._id).lean()).fulfillmentStatus, "CANCELED");
  assert.equal(await stock(), before + 1);
});

test("refund: a paid order's payment is cancelled at RozPardakht", async () => {
  const order = await checkout();
  await svc.confirmRozPayment({ orderId: order._id, userId: user, code: OTP });
  assert.equal(await svc.refundRozPayment(order._id), true);
  assert.equal(roz.calls.at(-1).fn, "cancelpayment");
  assert.equal((await Payment.findOne({ order: order._id }).lean()).status, "REJECTED");
  assert.equal(await svc.refundRozPayment(order._id), false, "nothing left to refund");
});
