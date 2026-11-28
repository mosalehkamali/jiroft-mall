// base/utils/discountCalculator.js
import { discountWindowFilter } from "base/utils/discountWindow";
import DiscountRule from "base/models/DiscountRule";
import { ruleBrandFilterPasses } from "base/utils/discountMatch";

/**
 * محاسبه تخفیف نهایی برای یک آیتم سبد خرید
 * @param {Object} params
 * @param {Object} params.product  - آبجکت محصول { _id, category, serie, brand, basePrice }
 * @param {Object} params.user     - آبجکت کاربر { _id, role, level } یا null
 * @param {number} params.cartTotal - مجموع کل سبد خرید
 * @param {boolean} params.isFirstOrder - آیا اولین سفارش است
 * @returns {{ discountAmount: number, appliedRule: Object|null }}
 */
export async function calculateDiscount({ product, user, cartTotal = 0, isFirstOrder = false }) {
  const now = new Date();

  // ساخت query برای یافتن قوانین مرتبط
  const orConditions = [
    { type: "global" },
    { type: "product", targets: product._id },
    { type: "category", targets: product.category },
    { type: "brand", targets: product.brand },
    ...(product.variantId ? [{ type: "variant", targets: product.variantId }] : []),
  ];
  if (product.serie) {
    orConditions.push({ type: "serie", targets: product.serie });
  }

  if (user) {
    if (user.role) {
      orConditions.push({ type: "userRole", targetRoles: user.role === "coach" ? "user" : user.role });
    }
    if (user.level > 0) {
      orConditions.push({ type: "userLevel", targetLevels: user.level });
    }
  }

  orConditions.push({ type: "cartValue", "conditions.minCartValue": { $lte: cartTotal } });

  const rules = await DiscountRule.find({
    active: true,
    ...discountWindowFilter(now),
    $or: orConditions,
  })
    .sort({ priority: 1 })
    .lean();

  let bestDiscount = 0;
  let appliedRule = null;

  for (const rule of rules) {
    // زیرفیلتر برند برای قوانین category (مثلاً «راکت‌های ویلسون») — منطقِ مشترک
    if (!ruleBrandFilterPasses(rule, product.brand)) continue;

    // بررسی شرایط
    if (rule.conditions?.minCartValue && cartTotal < rule.conditions.minCartValue) continue;
    if (rule.conditions?.onlyFirstOrders && !isFirstOrder) continue;
    if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) continue;

    const price = product.basePrice || 0;
    let discount = 0;

    if (rule.discount.kind === "percent") {
      discount = (price * rule.discount.value) / 100;
      if (rule.discount.maxAmount) {
        discount = Math.min(discount, rule.discount.maxAmount);
      }
    } else {
      discount = rule.discount.value;
    }

    discount = Math.min(discount, price); // تخفیف بیشتر از قیمت نمی‌شود

    if (discount > bestDiscount) {
      bestDiscount = discount;
      appliedRule = rule;
    }

    // اگر قابل ترکیب نیست، همین اولی کافی است
    if (!rule.combinable) break;
  }

  return { discountAmount: bestDiscount, appliedRule };
}
