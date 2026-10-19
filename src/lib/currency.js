/**
 * src/lib/currency.js
 *
 * توابع خالص تبدیل و فرمت ارز — بدون هیچ وابستگی سروری (mongoose/next-cache).
 * امن برای import در کامپوننت‌های client و server.
 *
 * store.config.js → commerce.pricing:
 *   mode "direct"   — قیمت ذخیره‌شده همان قیمت فروش است (نرخ همیشه ۱).
 *   mode "exchange" — قیمت به ارز خارجی ذخیره می‌شود و در نرخِ پنل ضرب می‌شود.
 *   roundTo         — قیمتِ نهایی به پایین، به مضربی از این عدد گرد می‌شود.
 *
 * نامِ توابع (eurToToman، formatToman) از نسخه‌ی اول مانده و در صدها جا
 * فراخوانی می‌شوند؛ معنایشان اکنون «قیمتِ ذخیره‌شده → ارزِ فروشگاه» است.
 */
import storeConfig from "base/store.config";

const { pricing = {}, currency = {} } = storeConfig.commerce || {};
const ROUND_TO = Math.max(1, Number(pricing.roundTo) || 1);
export const PRICING_MODE = pricing.mode === "exchange" ? "exchange" : "direct";
export const CURRENCY_LABEL = currency.label || "";

/**
 * قیمتِ ذخیره‌شده → قیمت به ارزِ فروشگاه
 * @param {number} storedPrice
 * @param {number} rate  نرخ تبدیل (در حالت direct نادیده گرفته می‌شود)
 * @returns {number}
 */
export function eurToToman(storedPrice, rate) {
  if (!storedPrice) return 0;
  if (PRICING_MODE === "exchange" && !rate) return 0;
  const raw = Math.round(Number(storedPrice) * (PRICING_MODE === "direct" ? 1 : rate));
  return Math.floor(raw / ROUND_TO) * ROUND_TO;
}

/**
 * فرمت قیمت برای نمایش (بدونِ برچسبِ ارز)
 * @param {number} amount
 * @returns {string}
 */
export function formatToman(amount) {
  return Number(amount).toLocaleString(currency.locale || "fa-IR");
}

/**
 * تبدیل و فرمت یکجا
 */
export function convertAndFormat(storedPrice, rate) {
  return formatToman(eurToToman(storedPrice, rate));
}
