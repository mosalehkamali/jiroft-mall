/**
 * services/rozPayment.service.js — installment purchase through RozPardakht.
 *
 *   checkout   order (UNPAID, stock reserved) + Payment PENDING → startRozPayment → SMS code to the customer
 *   code       confirmRozPayment: verifypassword → confirmpayment → Payment PAID → confirmOrderPaid
 *   resend     resendRozCode: the same payment key again
 *   abandoned  expireUnpaidOnlineOrders (inquiry first if a confirm was sent)
 *   cancelled  refundRozPayment (admin cancels a paid order)
 *
 * The payment key's parts (never the key: it holds the shop password) live on
 * Payment.meta.roz, so every call rebuilds exactly the same key.
 */
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import { cancelUnpaidOrder, confirmOrderPaid, markRozPaid } from "base/services/onlinePayment.service";
import { RozError, cancelPayment, confirmWithOtp, requestOtp, rozDatetime } from "base/services/payments/rozpardakht";

/** These answers to the code mean "try again", not "this payment is dead". */
const RETRYABLE = new Set(["-16", "-17"]);

export class RozFlowError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function startRozPayment(order, nationalCode) {
  const roz = { orderId: order.trackingCode, nationalCode, amountToman: order.totalPrice, datetime: rozDatetime(order.orderDate || new Date()) };
  const payment = await Payment.create({
    order: order._id,
    method: "ROZPARDAKHT",
    amount: order.totalPrice,
    status: "PENDING",
    onlinePayment: { gateway: "rozpardakht" },
    meta: { roz },
  });
  await Order.updateOne({ _id: order._id }, { $push: { payments: payment._id } });
  await requestOtp(roz); // throws → checkout deletes the order and releases its stock
  return payment;
}

/** The customer's own unpaid RozPardakht order and its pending payment. */
async function load(orderId, userId) {
  if (!/^[0-9a-f]{24}$/i.test(String(orderId))) throw new RozFlowError("سفارش یافت نشد", 404);
  const order = await Order.findOne({ _id: orderId, user: userId, paymentMethod: "ROZPARDAKHT" })
    .select("trackingCode paymentStatus fulfillmentStatus")
    .lean();
  if (!order) throw new RozFlowError("سفارش یافت نشد", 404);
  const payment = await Payment.findOne({ order: order._id, method: "ROZPARDAKHT" }).sort({ createdAt: -1 }).lean();
  return { order, payment };
}

export async function resendRozCode({ orderId, userId }) {
  const { order, payment } = await load(orderId, userId);
  if (order.fulfillmentStatus === "CANCELED" || payment?.status !== "PENDING") throw new RozFlowError("مهلت این پرداخت تمام شده است؛ دوباره سفارش دهید", 409);
  await requestOtp(payment.meta.roz);
}

/** @returns {{ status: "paid", trackingCode }} — throws RozFlowError / RozError otherwise */
export async function confirmRozPayment({ orderId, userId, code }) {
  const otp = String(code ?? "").trim().replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  if (!/^\d{3,10}$/.test(otp)) throw new RozFlowError("کد تأیید را درست وارد کنید");
  const { order, payment } = await load(orderId, userId);
  const paid = { status: "paid", trackingCode: order.trackingCode };
  if (payment?.status === "PAID") {
    await confirmOrderPaid(order._id); // a repeat after a crash finishes the job
    return paid;
  }
  if (order.fulfillmentStatus === "CANCELED" || payment?.status !== "PENDING") throw new RozFlowError("مهلت این پرداخت تمام شده است؛ دوباره سفارش دهید", 409);

  // from here on a lost answer may mean money moved: expiry asks RozPardakht before cancelling
  await Payment.updateOne({ _id: payment._id }, { $set: { "meta.roz.confirmAttemptedAt": new Date() } });
  let invoice = null;
  try {
    invoice = await confirmWithOtp(payment.meta.roz, otp);
  } catch (err) {
    if (!(err instanceof RozError)) throw err;
    if (err.code === "-3") {
      // already done: the earlier confirm went through
    } else if (err.code == null) {
      throw new RozFlowError("پاسخی از رزپرداخت نرسید. اگر مبلغی کسر شده باشد سفارش شما ظرف چند دقیقه خودکار تأیید می‌شود؛ دوباره پرداخت نکنید.", 502);
    } else if (RETRYABLE.has(err.code)) {
      throw new RozFlowError(err.message);
    } else {
      // dead payment (-1 credit, -2 failed, -18 expired, …): nothing was deducted, free the order
      await cancelUnpaidOrder(order._id);
      throw new RozFlowError(`${err.message}. سفارش لغو شد؛ می‌توانید با روش دیگری پرداخت کنید.`, 409);
    }
  }
  await markRozPaid(payment._id, invoice);
  await confirmOrderPaid(order._id);
  return paid;
}

/** Admin cancels a paid RozPardakht order: give the customer's credit back first. No-op otherwise. */
export async function refundRozPayment(orderId) {
  const payment = await Payment.findOne({ order: orderId, method: "ROZPARDAKHT", status: "PAID" }).lean();
  if (!payment) return false;
  await cancelPayment(payment.meta.roz);
  await Payment.updateOne({ _id: payment._id }, { $set: { status: "REJECTED", "meta.roz.cancelledAt": new Date() } });
  return true;
}
