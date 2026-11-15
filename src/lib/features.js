/**
 * src/lib/features.js — the feature registry.
 *
 * store.config.js says which features a store wants; this file says what each
 * feature *owns*, so that turning one off removes it everywhere at once:
 *
 *   paths        storefront pages, customer dashboard pages and API routes.
 *                src/middleware.js answers 404 for all of them.
 *   modules      admin permission modules (src/lib/permissions.js). Their keys
 *                drop out of every admin's effective permissions — including
 *                full access — so the sidebar entry, the admin pages and the
 *                admin API gates all close together.
 *   permissions  single permission keys, for features that live inside a
 *                module that otherwise stays (e.g. EUR bookkeeping on orders).
 *
 * Workers, crons, notifications and storefront sections call
 * isFeatureEnabled() directly.
 *
 * A feature is enabled only if it is switched on AND every feature in its
 * `requires` is enabled — so dependencies can never be half-on.
 *
 * Disabling never deletes data: nothing here writes to the database.
 *
 * Pure module (no server imports) — safe in client components.
 */

import storeConfig from "../../store.config.js";

// "*" matches exactly one path segment; every pattern is a prefix.
export const FEATURES = {
  brands: {
    label: "برندها",
    paths: ["/api/brands"],
    modules: ["brands"],
  },
  series: {
    label: "سری‌های محصول",
    requires: ["brands"],
    paths: ["/api/series"],
    modules: ["series"],
  },
  limitedEditions: {
    label: "لیمیتد ادیشن",
    requires: ["brands"],
    paths: ["/api/limited-editions", "/api/admin/home-roland-garros"],
    modules: ["limitedEditions", "homeRolandGarros"],
  },
  departments: {
    label: "دپارتمان‌ها",
    paths: ["/api/sports"],
    modules: ["sports"],
  },
  targetAudience: { label: "مخاطب هدف" },
  technicalStats: { label: "شاخص‌های فنی" },
  compare: {
    label: "مقایسه محصولات",
    paths: ["/compare", "/api/compare"],
  },
  collections: {
    label: "کالکشن‌ها",
    paths: ["/collection", "/api/events", "/api/admin/events"],
    modules: ["collections"],
  },
  articles: {
    label: "مجله و مقالات",
    paths: [
      "/content",
      "/rss.xml",
      "/api/articles",
      "/api/admin/articles",
      "/api/admin/article-cms",
      "/api/admin/article-categories",
      "/api/admin/article-tags",
    ],
    modules: ["articles", "articleTaxonomy", "homeFeaturedArticles"],
  },
  secondHand: {
    label: "کالای دست دوم",
    paths: [
      "/second-hand",
      "/api/admin/used-products",
      "/api/admin/healthcards",
      "/api/admin/orders/used-product-tracking",
    ],
    modules: ["secondHand", "healthCards"],
  },
  orderFlows: {
    label: "فرایند سفارش",
    paths: ["/api/order-flows", "/api/admin/order-flows"],
    modules: ["orderFlows"],
  },
  athletes: {
    label: "ورزشکاران",
    requires: ["departments"],
    paths: ["/athletes", "/api/athletes", "/api/ai/athlete-prompt"],
    modules: ["athletes"],
    permissions: ["ai.athletePrompt"],
  },
  racketFinder: {
    label: "راکت‌یاب",
    requires: ["departments", "technicalStats"],
    paths: ["/match", "/api/match"],
  },
  reviews: {
    label: "نظرات",
    paths: ["/api/comments", "/api/admin/comments", "/api/cron/review-followup"],
    modules: ["comments"],
  },
  wishlist: {
    label: "علاقه‌مندی‌ها",
    paths: ["/p-user/wishlist", "/api/wishlist"],
  },
  tickets: {
    label: "تیکت پشتیبانی",
    paths: ["/p-user/tickets", "/api/tickets", "/api/admin/tickets"],
    modules: ["tickets"],
  },
  contactForm: {
    label: "فرم تماس",
    paths: ["/api/contact", "/api/admin/contact-messages"],
    modules: ["contactMessages"],
  },
  newsletter: {
    label: "خبرنامه",
    paths: ["/api/newsletter"],
  },
  broadcasts: {
    label: "اعلان به کاربران",
    paths: ["/api/notifications", "/api/admin/user-notifications"],
    modules: ["userNotifications"],
  },
  push: {
    label: "اعلان مرورگر (Push)",
    paths: ["/api/push"],
  },
  googleAuth: {
    label: "ورود با گوگل",
    paths: ["/api/auth/google"],
  },
  discounts: {
    label: "تخفیف‌ها و کد تخفیف",
    paths: [
      "/api/admin/discounts",
      "/api/admin/quantity-discounts",
      "/api/admin/coupons",
      "/api/admin/orders/*/discount",
    ],
    modules: ["discounts"],
    permissions: ["orders.adjustDiscount"],
  },
  wallet: {
    label: "کیف پول",
    paths: [
      "/p-user/wallet",
      "/api/wallet",
      "/api/admin/users/*/wallet",
      "/api/cron/wallet-notifications",
    ],
  },
  reviewCredit: {
    label: "پاداش ثبت نظر",
    requires: ["reviews", "wallet"],
    paths: ["/api/admin/comments/*/reward"],
    modules: ["reviewCredit"],
  },
  coach: {
    label: "مربیان",
    requires: ["wallet", "discounts"],
    paths: [
      "/p-user/coach",
      "/api/coach",
      "/api/profile/coach-apply",
      "/api/profile/coach-lookup",
      "/api/profile/link-coach",
      "/api/admin/coaches",
      "/api/admin/coach-applications",
      "/api/admin/coach-credits",
    ],
    modules: ["coaches"],
  },
  installments: {
    label: "فروش اقساطی",
    paths: [
      "/p-user/installments",
      "/api/installments",
      "/api/installment-rate",
      "/api/admin/installments",
      "/api/admin/installment-balance",
      "/api/cron/installment-reminders",
    ],
    modules: ["installments", "financingSettings"],
  },
  orderEur: {
    label: "حسابداری یورویی سفارش",
    paths: ["/api/admin/orders/*/eur"],
    permissions: ["orders.setCurrency"],
  },
  // Not a switch in store.config.js: on exactly when commerce.pricing.mode is
  // "exchange" (see resolveFlags below).
  exchangeRate: {
    label: "نرخ تبدیل ارز",
    // /api/exchange-rate stays public in both modes (it answers 1 in "direct").
    paths: ["/api/admin/exchange-rate", "/api/admin/market-rates"],
    modules: ["exchangeRate"],
  },
  warehouse: {
    label: "انبار و بارکد",
    paths: ["/api/admin/orders/tracking-items", "/api/admin/orders/*/tracking"],
    modules: ["orderTracking"],
  },
  mahak: {
    label: "حسابداری محک",
    // /api/checkout/stock-check stays open: it answers "ok" while this is off.
    paths: ["/api/admin/mahak", "/api/cron/mahak-sync", "/p-admin/mahak"],
    modules: ["mahak"],
  },
  aiAssistant: {
    label: "دستیار هوشمند",
    paths: ["/api/admin/assistant"],
    modules: ["assistant"],
  },
  aiProductDraft: {
    label: "پیش‌نویس محصول با AI",
    // The prompt is built per department (sport_id/sport_lock, athletes of that
    // department): a category without one cannot produce a prompt.
    requires: ["departments"],
    paths: [
      "/api/ai/product-draft",
      "/api/admin/product-prompts",
      "/api/product/*/regenerate",
      "/p-admin/admin-products/prompt-settings",
      "/p-admin/admin-products/*/regenerate",
    ],
    modules: ["productPrompts"],
    permissions: ["ai.productDraft"],
  },
};

function resolveFlags(config) {
  const wanted = { ...(config.features || {}) };
  wanted.exchangeRate = config.commerce?.pricing?.mode === "exchange";

  const enabled = new Set();
  const visiting = new Set();
  const isOn = (key) => {
    if (enabled.has(key)) return true;
    if (!FEATURES[key] || wanted[key] !== true || visiting.has(key)) return false;
    visiting.add(key);
    const ok = (FEATURES[key].requires || []).every(isOn);
    visiting.delete(key);
    if (ok) enabled.add(key);
    return ok;
  };
  Object.keys(FEATURES).forEach(isOn);
  return enabled;
}

const ENABLED = resolveFlags(storeConfig);

export function isFeatureEnabled(key) {
  return ENABLED.has(key);
}

export function enabledFeatures() {
  return [...ENABLED];
}

function matches(pattern, pathname) {
  const p = pattern.split("/").filter(Boolean);
  const s = pathname.split("/").filter(Boolean);
  if (s.length < p.length) return false;
  return p.every((seg, i) => seg === "*" || seg === s[i]);
}

/** The disabled feature that owns this path, or null. */
export function disabledFeatureForPath(pathname) {
  for (const [key, def] of Object.entries(FEATURES)) {
    if (ENABLED.has(key) || !def.paths) continue;
    if (def.paths.some((pattern) => matches(pattern, pathname))) return key;
  }
  return null;
}

const DISABLED_MODULES = new Set();
const DISABLED_PERMISSIONS = new Set();
for (const [key, def] of Object.entries(FEATURES)) {
  if (ENABLED.has(key)) continue;
  (def.modules || []).forEach((m) => DISABLED_MODULES.add(m));
  (def.permissions || []).forEach((p) => DISABLED_PERMISSIONS.add(p));
}

/** false when the permission key belongs to a disabled feature. */
export function isPermissionKeyEnabled(fullKey) {
  if (DISABLED_PERMISSIONS.has(fullKey)) return false;
  return !DISABLED_MODULES.has(String(fullKey).split(".")[0]);
}

export function isModuleEnabled(moduleKey) {
  return !DISABLED_MODULES.has(moduleKey);
}

/** For a link list: drop hrefs that point into a disabled feature. */
export function isHrefEnabled(href) {
  if (typeof href !== "string" || !href.startsWith("/")) return true;
  return !disabledFeatureForPath(href.split(/[?#]/)[0]);
}

export const __test = { resolveFlags, matches };
