/**
 * لایه‌ی مخصوصِ محصول روی جستجوی مشترک (`@/lib/search`).
 *
 * تفاوتش با جستجوی عمومی: برند و سری روی محصول ref هستند، نه متن. پس «Wilson
 * Blade» وقتی هم باید جواب بدهد که «Wilson» فقط در سندِ برند باشد و اصلاً در
 * نامِ محصول نیامده باشد. برای همین توکن‌هایی که در فیلدهای متنیِ محصول پیدا
 * نمی‌شوند، با آی‌دیِ برند/سری تطبیق داده می‌شوند.
 */

import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Serie from "base/models/Serie";
import Sport from "base/models/Sport";
import {
  buildSearchFilter,
  normalizeSearchText,
  rankBySearch,
  searchTokens,
} from "@/lib/search";
import { isFeatureEnabled } from "@/lib/features";
import { resolveProductRules, searchablePaths } from "@/lib/productRules";

/** فیلدهای متنیِ محصول که جستجو رویشان انجام می‌شود */
export const PRODUCT_SEARCH_FIELDS = ["name", "sku", "slug", "color", "tag"];

/**
 * کدام refها می‌توانند یک توکن را برآورده کنند. `slug` عمداً هست: نامِ محصول
 * فارسی است («راکت تنیس ویلسون Blade 98») ولی slugِ دسته انگلیسی («racket»)،
 * پس «Blade racket» فقط با همین وصله جواب می‌دهد.
 */
const REF_SOURCES = [
  ["brand", Brand, "brands"],
  ["serie", Serie, "series"],
  ["category", Category, null],
  ["sport", Sport, "departments"],
];

/**
 * فیلدهایی که جستجو رویشان انجام می‌شود. ادمین همه‌چیز را جستجو می‌کند؛ مشتری فقط
 * آنچه store.config.js «searchable» کرده (به‌علاوه‌ی ویژگی‌های دسته‌ی قابل‌جستجو) —
 * هرگز فیلدی که به او نمایش داده نمی‌شود.
 */
async function searchFields(storefront) {
  const rules = resolveProductRules([]);
  if (!storefront) {
    return [...PRODUCT_SEARCH_FIELDS, ...rules.customFields.map((f) => `customFields.${f.key}`)];
  }
  const attrNames = await Category.distinct("attributes.name", {
    attributes: { $elemMatch: { searchable: true, isPublic: { $ne: false } } },
  });
  const categories = await Category.find({ "attributes.name": { $in: attrNames } }).select("attributes").lean();
  const searchableAttrs = new Set();
  for (const c of categories) for (const a of c.attributes || []) if (a.searchable && a.isPublic !== false) searchableAttrs.add(a.name);
  return [...searchablePaths(rules), ...[...searchableAttrs].map((n) => `attributes.${n}`)];
}

/** یک بار refهای مرتبط با کلِ کوئری را می‌گیرد (نه یکی به‌ازای هر توکن) */
async function loadRefCandidates(query, storefront) {
  const filter = buildSearchFilter(query, ["title", "name", "slug"]);
  if (!filter) return [];
  // `$or` چون اینجا برعکسِ محصول است: کافی است ref *یکی* از توکن‌ها را داشته باشد
  const anyToken = { $or: filter.$and };
  const rules = resolveProductRules([]);
  const sources = REF_SOURCES.filter(([field, , feature]) =>
    (!feature || isFeatureEnabled(feature)) && (!storefront || rules.fields[field]?.searchable || field === "category"),
  );
  return Promise.all(
    sources.map(async ([field, Model]) => [
      field,
      await Model.find(anyToken).select("_id title name slug").lean(),
    ])
  );
}

const hasToken = (doc, token) =>
  normalizeSearchText(`${doc.title || ""} ${doc.name || ""} ${doc.slug || ""}`).includes(token);

/**
 * فیلترِ محصول را با شرطِ جستجو ترکیب می‌کند. هر توکن باید یا در یکی از فیلدهای
 * متنیِ محصول بیاید یا برند/سریِ محصول را نشان بدهد.
 * فیلترِ ورودی mutate نمی‌شود؛ اگر کوئری خالی باشد عیناً همان برمی‌گردد.
 */
export async function withProductSearch(filter, query, { storefront = false } = {}) {
  const tokens = searchTokens(query);
  if (!tokens.length) return { ...filter };

  const textConditions = buildSearchFilter(query, await searchFields(storefront)).$and;
  const refs = await loadRefCandidates(query, storefront);

  const clauses = tokens.map((token, i) => {
    const or = [...textConditions[i].$or];
    for (const [field, docs] of refs) {
      const ids = docs.filter((doc) => hasToken(doc, token)).map((doc) => doc._id);
      if (ids.length) or.push({ [field]: { $in: ids } });
    }
    return { $or: or };
  });

  const previous = Array.isArray(filter?.$and) ? filter.$and : [];
  return { ...filter, $and: [...previous, ...clauses] };
}

/**
 * مرتب‌سازی بر اساسِ ربط. وزن‌ها ترتیبِ خواسته‌شده را می‌سازند:
 * SKUِ دقیق → نام → برند/سری. `brand`/`serie` اگر populate شده باشند استفاده
 * می‌شوند، وگرنه بی‌سروصدا نادیده گرفته می‌شوند.
 */
export function rankProducts(query, products) {
  return rankBySearch(query, products, (p) => [
    [p.sku, 3],
    [p.name, 2],
    [p.brand?.title || p.brand?.name, 1],
    [p.serie?.title || p.serie?.name, 1],
    [Array.isArray(p.tag) ? p.tag.join(" ") : p.tag, 0.5],
    // دسته/ورزش فقط ربط را کمی جابه‌جا می‌کنند؛ نامِ محصول همیشه غالب است
    [p.category?.title || p.category?.name, 0.3],
    [p.category?.slug, 0.3],
    [p.sport?.title || p.sport?.name, 0.2],
  ]);
}
