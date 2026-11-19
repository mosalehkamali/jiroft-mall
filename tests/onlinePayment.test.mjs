// node --test --test-timeout=180000 tests/onlinePayment.test.mjs
//
// Online payment end to end against a real replica set, with ZarinPal's REST
// API replaced by a fake that follows its v4 contract (request → authority,
// verify → 100 / 101 / error). Checks that only a verified payment marks an
// order paid, that repeats are harmless, and that abandoned orders give their
// stock back.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register("./productCreationHooks.mjs", import.meta.url); // aliases + next/* resolution

process.env.ZARINPAL_MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
process.env.NEXT_PUBLIC_BASE_URL = "https://shop.test";

const gateway = { requests: [], verifies: [], paid: new Set(), verified: new Set(), down: false };
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const json = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (gateway.down) throw new TypeError("fetch failed");
  assert.equal(body.merchant_id, process.env.ZARINPAL_MERCHANT_ID);
  if (url.endsWith("/pg/v4/payment/request.json")) {
    gateway.requests.push(body);
    return json({ data: { code: 100, message: "Success", authority: `A${String(gateway.requests.length).padStart(35, "0")}` }, errors: [] });
  }
  if (url.endsWith("/pg/v4/payment/verify.json")) {
    gateway.verifies.push(body);
    if (!gateway.paid.has(body.authority)) return json({ data: [], errors: { code: -51, message: "Session is not paid" } });
    if (gateway.verified.has(body.authority)) return json({ data: { code: 101, ref_id: 777 }, errors: [] });
    gateway.verified.add(body.authority);
    return json({ data: { code: 100, ref_id: 777, card_pan: "6037**1234" }, errors: [] });
  }
  return new Response("", { status: 404 });
};

let repl, Order, Payment, Product, svc, zarinpal, product;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import("../models/registerModels.js");
  Order = mongoose.model("Order");
  Payment = mongoose.model("Payment");
  Product = mongoose.model("Product");
  await Promise.all([Order.init(), Product.init()]);
  svc = await import("../services/onlinePayment.service.js");
  zarinpal = await import("../services/payments/zarinpal.js");
  product = await Product.create({ name: "کفش", sku: "S1", basePrice: 1000, stock: 4 });
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

/** What checkout does for ONLINE: order with reserved stock, then the gateway. */
async function checkout(qty = 1) {
  await Product.updateOne({ _id: product._id }, { $inc: { stock: -qty } });
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product: product._id, quantity: qty, unitPrice: 150000 }],
    subtotalPrice: 150000 * qty,
    totalPrice: 150000 * qty,
    paymentMethod: "ONLINE",
    inventoryReserved: true,
  });
  const { url } = await svc.startOnlinePayment(order, { mobile: "09120000000" });
  const payment = await Payment.findOne({ order: order._id }).lean();
  return { order, url, authority: payment.onlinePayment.authority };
}
const stock = async () => (await Product.findById(product._id).lean()).stock;

test("start: amount goes to the gateway in Rial, the customer gets its StartPay URL", async () => {
  const { order, url, authority } = await checkout();
  const req = gateway.requests.at(-1);
  assert.equal(req.amount, 1500000);
  assert.equal(req.callback_url, `https://shop.test/api/payments/online/callback?orderId=${order._id}`);
  assert.equal(req.metadata.mobile, "09120000000");
  assert.equal(url, `https://payment.zarinpal.com/pg/StartPay/${authority}`);
  assert.equal((await Order.findById(order._id).lean()).payments.length, 1);
});

test("only a payment the gateway verifies marks the order paid", async () => {
  const { order, authority } = await checkout();

  // the customer pressed "cancel" at the gateway
  assert.equal((await svc.handleGatewayReturn({ orderId: order._id, authority, status: "NOK" })).status, "failed");
  assert.equal((await Order.findById(order._id).lean()).paymentStatus, "UNPAID");

  // a forged "OK" with an unpaid authority: the gateway says no
  const second = await checkout();
  assert.equal((await svc.handleGatewayReturn({ orderId: second.order._id, authority: second.authority, status: "OK" })).status, "failed");
  assert.equal((await Order.findById(second.order._id).lean()).paymentStatus, "UNPAID");

  // somebody else's authority, or a made-up one
  assert.equal((await svc.handleGatewayReturn({ orderId: order._id, authority: second.authority, status: "OK" })).status, "invalid");
  assert.equal((await svc.handleGatewayReturn({ orderId: "nope", authority: "x", status: "OK" })).status, "invalid");
});

test("a real payment: verified with the same Rial amount, order paid and processing, repeat is harmless", async () => {
  const { order, authority } = await checkout(2);
  gateway.paid.add(authority);
  const result = await svc.handleGatewayReturn({ orderId: order._id, authority, status: "OK" });
  assert.deepEqual(result, { status: "paid", trackingCode: order.trackingCode });
  assert.equal(gateway.verifies.at(-1).amount, 3000000);

  const paid = await Order.findById(order._id).lean();
  assert.equal(paid.paymentStatus, "PAID");
  assert.equal(paid.fulfillmentStatus, "PROCESSING");
  const payment = await Payment.findOne({ order: order._id }).lean();
  assert.equal(payment.status, "PAID");
  assert.equal(payment.onlinePayment.refId, "777");

  // the browser reloads the callback URL
  const verifies = gateway.verifies.length;
  assert.equal((await svc.handleGatewayReturn({ orderId: order._id, authority, status: "OK" })).status, "paid");
  assert.equal(gateway.verifies.length, verifies, "an already-paid payment is not verified again");
  assert.equal(await Payment.countDocuments({ order: order._id, status: "PAID" }), 1);
});

test("abandoned orders are cancelled and give their stock back; paid ones are kept", async () => {
  await Order.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 60 * 60000) } }); // mongoose keeps createdAt immutable
  const before = await stock();
  const expired = await svc.expireUnpaidOnlineOrders();
  assert.equal(expired, 3, "the three unpaid orders of the earlier tests");
  assert.equal(await stock(), before + 3);
  assert.equal(await Order.countDocuments({ fulfillmentStatus: "CANCELED", inventoryReserved: false }), 3);
  assert.equal(await Order.countDocuments({ paymentStatus: "PAID", fulfillmentStatus: "PROCESSING" }), 1);
  assert.equal(await Payment.countDocuments({ status: "PENDING" }), 0);
  assert.equal(await svc.expireUnpaidOnlineOrders(), 0, "running again changes nothing");
});

test("a payment that comes back after its order expired is never verified", async () => {
  const { order, authority } = await checkout();
  await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 60 * 60000) } });
  await svc.expireUnpaidOnlineOrders();
  gateway.paid.add(authority); // the customer paid at the very last moment
  const verifies = gateway.verifies.length;
  assert.equal((await svc.handleGatewayReturn({ orderId: order._id, authority, status: "OK" })).status, "expired");
  assert.equal(gateway.verifies.length, verifies, "unverified, so the gateway returns the money");
  assert.equal((await Order.findById(order._id).lean()).paymentStatus, "UNPAID");
});

test("gateway unreachable or not configured → a clear error, never a paid order", async () => {
  gateway.down = true;
  await assert.rejects(
    zarinpal.requestPayment({ amountToman: 1000, callbackUrl: "https://shop.test/cb" }),
    (err) => err.name === "GatewayError" && /درگاه/.test(err.message),
  );
  const verified = await zarinpal.verifyPayment({ amountToman: 1000, authority: "A1" }).catch((e) => e);
  assert.equal(verified.name, "GatewayError");
  gateway.down = false;

  const id = process.env.ZARINPAL_MERCHANT_ID;
  process.env.ZARINPAL_MERCHANT_ID = "";
  assert.equal(zarinpal.zarinpalConfigured(), false);
  await assert.rejects(zarinpal.requestPayment({ amountToman: 1000, callbackUrl: "x" }), /تنظیم نشده/);
  process.env.ZARINPAL_MERCHANT_ID = id;
});
