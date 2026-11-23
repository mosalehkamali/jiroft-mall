/**
 * RozPardakht web API 3.2.6 (installment credit; the customer confirms with an SMS code).
 *
 *   ROZPARDAKHT_USERNAME   webApiUserName
 *   ROZPARDAKHT_PASSWORD   webApiPassword (must not contain "-": it is the key separator)
 *   ROZPARDAKHT_SHOP_ID    shopId
 *
 * Every call is a GET whose path carries the "payment key":
 *   username-password-orderId-nationalCode-price-shopId-datetime
 * The key holds the password, so it is never stored or sent to a browser:
 * it is rebuilt from the payment's stored parts on every call.
 * Amounts are passed in Toman and sent in Rial; the date is Jalali, Tehran time.
 */
const BASE = "https://rozpardakht.ir/api/payment";

export const ROZ_ERRORS = {
  "-1": "اعتبار شما در رزپرداخت برای این خرید کافی نیست",
  "-2": "پرداخت با شکست مواجه شد",
  "-3": "این پرداخت قبلاً انجام شده است",
  "-10": "کلید پرداخت صحیح ساخته نشده",
  "-11": "کد ملی صحیح نیست",
  "-12": "مبلغ صحیح نیست",
  "-13": "شماره فروشگاه صحیح نیست",
  "-14": "با این کد ملی در رزپرداخت ثبت‌نام نشده است",
  "-15": "فروشگاهی با این شماره در رزپرداخت ثبت نشده",
  "-16": "کد تأیید وارد شده صحیح نیست",
  "-17": "کد تأیید منقضی شده است؛ کد جدید بگیرید",
  "-18": "مهلت این پرداخت تمام شده است",
  "-19": "کد پرداخت صحیح نیست",
  "-20": "در حال حاضر امکان فروش از طریق رزپرداخت وجود ندارد",
  "-21": "فروشگاه در رزپرداخت غیرفعال است",
  "-22": "فروشگاه توسط رزپرداخت غیرفعال شده است",
  "-23": "شماره سفارش نامعتبر است",
  "-24": "مبلغ نقدی صحیح نیست",
  "-25": "نام کاربری یا رمز فروشنده در رزپرداخت صحیح نیست",
  "-26": "تاریخ ارسالی صحیح نیست",
  "-31": "حساب شما توسط رزپرداخت غیرفعال شده است",
  "-32": "چنین پرداختی ثبت نشده است",
  "-33": "از استعلام قبلی کمتر از ۳۰ ثانیه گذشته است",
  "-34": "خطا در استعلام از رزپرداخت",
  "-35": "صورتحسابی با این کد پرداخت یافت نشد",
  "-36": "لغو پرداخت در رزپرداخت انجام نشد",
  "-41": "مدیری با این مشخصات برای فروشگاه یافت نشد",
};

export class RozError extends Error {
  constructor(code, message) {
    super(message || ROZ_ERRORS[code] || `خطای رزپرداخت (${code ?? "ارتباط"})`);
    this.name = "GatewayError"; // the checkout route answers GatewayError with a 502 + this message
    this.code = code;
  }
}

const env = () => ({
  user: process.env.ROZPARDAKHT_USERNAME || "",
  pass: process.env.ROZPARDAKHT_PASSWORD || "",
  shop: process.env.ROZPARDAKHT_SHOP_ID || "",
});
export const rozpardakhtConfigured = () => {
  const { user, pass, shop } = env();
  return Boolean(user && pass && shop) && ![user, pass, shop].some((v) => v.includes("-"));
};

/** Iranian national id checksum. */
export function isValidNationalCode(raw) {
  const code = String(raw ?? "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const sum = [...code.slice(0, 9)].reduce((s, d, i) => s + Number(d) * (10 - i), 0) % 11;
  const check = Number(code[9]);
  return sum < 2 ? check === sum : check === 11 - sum;
}
export const normalizeNationalCode = (raw) => String(raw ?? "").trim().replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

/** yyyy;MM;dd;hh;mm in the Jalali calendar, Tehran time, 24-hour. */
export function rozDatetime(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year};${parts.month};${parts.day};${parts.hour};${parts.minute}`;
}

/** parts: { orderId, nationalCode, amountToman, datetime } — stored on the Payment. */
export function paymentKey({ orderId, nationalCode, amountToman, datetime }) {
  const { user, pass, shop } = env();
  return [user, pass, orderId, nationalCode, Math.round(amountToman * 10), shop, datetime].join("-");
}

async function call(fn, key) {
  const path = encodeURIComponent(key).replace(/%3B/gi, ";");
  let res;
  try {
    res = await fetch(`${BASE}/${fn}/${path}`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  } catch (err) {
    throw new RozError(null, `ارتباط با رزپرداخت برقرار نشد (${err?.name === "TimeoutError" ? "پایان مهلت" : "خطای شبکه"})`);
  }
  // the answer is a bare string, possibly JSON-quoted; errors come as a negative number (status 406)
  const text = (await res.text().catch(() => "")).trim().replace(/^"|"$/g, "").trim();
  if (/^-\d+$/.test(text)) throw new RozError(text);
  if (!res.ok || !text) throw new RozError(null, `پاسخ نامعتبر از رزپرداخت (${res.status})`);
  return text;
}

const expectOk = (text) => {
  if (text.toLowerCase() !== "ok") throw new RozError(null, `پاسخ نامعتبر از رزپرداخت: ${text.slice(0, 40)}`);
};

/** Checks the customer's credit and sends them the SMS code. */
export async function requestOtp(parts) {
  expectOk(await call("pay", paymentKey(parts)));
}

/** SMS code → confirmed payment. @returns the RozPardakht invoice number */
export async function confirmWithOtp(parts, otp) {
  const key = paymentKey(parts);
  const invoiceToken = await call("verifypassword", `${key}-${otp}`);
  return call("confirmpayment", `${key}-${invoiceToken}`);
}

/** true = paid. Throws RozError (-32: no such payment; -33: wait 30 s). */
export async function inquire(parts) {
  expectOk(await call("inquiry", paymentKey(parts)));
  return true;
}

export async function cancelPayment(parts) {
  expectOk(await call("cancelpayment", paymentKey(parts)));
}
