import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import { ExchangeRate } from "base/models/ExchangeRate";
import { PRICING_MODE } from "@/lib/currency";

// توابع خالص فرمت/تبدیل از ماژول client-safe دوباره export می‌شوند
// تا importهای سروریِ موجود بدون تغییر کار کنند.
// ⚠️ کامپوننت‌های client باید مستقیماً از "@/lib/currency" import کنند،
// چون این فایل getCachedRate (وابسته به mongoose/next-cache) را هم دارد.
export { eurToToman, formatToman, convertAndFormat } from "@/lib/currency";

const getStoredRate = unstable_cache(
  async () => {
    await connectToDB();
    const doc = await ExchangeRate.findOne({ currency: "EUR" }).lean();
    return doc?.rateToToman ?? null;
  },
  ["exchange-rate-v2"],
  { revalidate: 10800, tags: ["exchange-rate"] }
);

/**
 * نرخ تبدیل — در حالت قیمت‌گذاریِ «direct» همیشه ۱ (قیمتِ ذخیره‌شده همان قیمت
 * فروش است و نرخی در دیتابیس لازم نیست)؛ در حالت «exchange» نرخِ پنل ادمین،
 * کش‌شده با تگ "exchange-rate".
 */
export async function getCachedRate() {
  return PRICING_MODE === "direct" ? 1 : getStoredRate();
}
