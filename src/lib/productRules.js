/**
 * src/lib/productRules.js — the store's product data rules.
 *
 * store.config.js (catalog.product) declares, per field: whether the store uses
 * it, from which stage it is required, whether admins see it, whether customers
 * see it, whether it is a filter or a search term, and its validation. This
 * module turns that declaration (plus per-category overrides) into resolved
 * rules and is the ONLY place those rules are interpreted:
 *
 *   validateProductData   admin create/edit API, bulk import, admin forms
 *   purchaseStatus        checkout / cart pricing, product page, listings
 *   toPublicProduct       everything that sends a product to a customer
 *   searchablePaths       storefront search
 *
 * Stages are ordered: draft < published < purchasable.
 *   draft        any saved product (isActive = false)
 *   published    visible in the storefront (isActive = true)
 *   purchasable  published AND can actually be bought
 * A rule `required: "published"` therefore also applies to purchasable, and a
 * product may be saved as a draft without it.
 *
 * Pure module (no server imports) — safe in client components.
 */

import storeConfig from "../../store.config.js";
import { isFeatureEnabled } from "./features.js";

export const STAGES = ["draft", "published", "purchasable"];

/**
 * Built-in fields the rules know about. `feature`: the field exists only while
 * that feature is on. `type` drives validation and the admin input.
 */
export const CORE_FIELDS = {
  name: { type: "text", label: "نام محصول" },
  sku: { type: "text", label: "کد کالا (SKU)" },
  category: { type: "ref", label: "دسته‌بندی" },
  brand: { type: "ref", label: "برند", feature: "brands" },
  serie: { type: "ref", label: "سری", feature: "series" },
  limitedEdition: { type: "ref", label: "لیمیتد ادیشن", feature: "limitedEditions" },
  sport: { type: "ref", label: storeConfig.catalog?.departmentLabel || "دپارتمان", feature: "departments" },
  athlete: { type: "refs", label: "ورزشکار", feature: "athletes" },
  targetAudience: { type: "select", label: "مخاطب هدف", feature: "targetAudience" },
  technicalStats: { type: "object", label: "شاخص‌های فنی", feature: "technicalStats" },
  shortDescription: { type: "textarea", label: "توضیح کوتاه" },
  longDescription: { type: "html", label: "توضیحات کامل" },
  mainImage: { type: "image", label: "تصویر اصلی" },
  gallery: { type: "images", label: "گالری تصاویر" },
  basePrice: { type: "number", label: "قیمت پایه" },
  // the exact count is internal by default; customers see "available or not"
  stock: { type: "number", label: "موجودی", public: false, min: 0 },
  color: { type: "text", label: "رنگ" },
  tag: { type: "tags", label: "برچسب‌ها" },
  label: { type: "select", label: "نشان ویژه" },
};

export const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "boolean", "select", "date", "url"];

const DEFAULT_RULE = {
  use: true,
  required: false,
  public: true,
  filterable: false,
  searchable: false,
};

function normalizeRequired(value) {
  if (value === true) return "published";
  return STAGES.includes(value) ? value : false;
}

function finalize(key, rule) {
  const out = { ...DEFAULT_RULE, ...rule, key };
  out.required = normalizeRequired(out.required);
  if (out.admin === undefined) out.admin = out.use;
  if (!out.use) {
    out.admin = false;
    out.public = false;
    out.required = false;
    out.filterable = false;
    out.searchable = false;
  }
  if (!out.public) {
    // what customers never see cannot be offered to them as a filter or a search term
    out.filterable = false;
    out.searchable = false;
  }
  return out;
}

/**
 * Resolved rules for a product in a category.
 * @param {string[]} categoryChain category slugs, root → leaf (empty = no category)
 */
export function resolveProductRules(categoryChain = [], config = storeConfig) {
  const productConfig = config.catalog?.product || {};
  const inventory = config.commerce?.inventory?.mode || "none";
  const overrides = (categoryChain || [])
    .map((slug) => productConfig.categoryRules?.[slug])
    .filter(Boolean);

  const fields = {};
  for (const [key, core] of Object.entries(CORE_FIELDS)) {
    let rule = { ...core, ...(productConfig.fields?.[key] || {}) };
    for (const o of overrides) rule = { ...rule, ...(o.fields?.[key] || {}) };
    if (core.feature && !isFeatureEnabled(core.feature)) rule.use = false;
    if (key === "stock" && inventory !== "stock") rule.use = false;
    if (key === "name") Object.assign(rule, { use: true, required: "draft", admin: true });
    fields[key] = finalize(key, rule);
  }

  const custom = new Map();
  for (const def of [
    ...(productConfig.customFields || []),
    ...overrides.flatMap((o) => o.customFields || []),
  ]) {
    if (!def?.key) continue;
    custom.set(def.key, finalize(def.key, { type: "text", ...def }));
  }

  let purchase = config.commerce?.purchase?.mode || "cart";
  for (const o of overrides) if (o.purchase) purchase = o.purchase;

  return { fields, customFields: [...custom.values()].filter((f) => f.use), purchase, inventory };
}

export function requiredAt(rule, stage) {
  if (!rule?.use || !rule.required) return false;
  return STAGES.indexOf(stage) >= STAGES.indexOf(rule.required);
}

export function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && !(value instanceof Date) && !value._bsontype) {
    return Object.keys(value).length === 0;
  }
  return false;
}

const hasPrice = (product, variants) =>
  Number(product?.basePrice) > 0 ||
  (variants || []).some((v) => Number(v?.price) > 0);

/** Is the field filled in, in the sense that matters for a requirement? */
function present(key, value, product, variants) {
  // 0 is a stored default, not a price; a variant price satisfies it too
  if (key === "basePrice") return hasPrice(product, variants);
  return !isEmptyValue(value);
}

function checkValue(rule, value, fail) {
  if (isEmptyValue(value)) return;
  const label = rule.label || rule.key;
  const type = rule.type;

  if (type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return fail(`«${label}» باید عدد باشد`);
    if (rule.min != null && n < rule.min) return fail(`«${label}» نباید کمتر از ${rule.min} باشد`);
    if (rule.max != null && n > rule.max) return fail(`«${label}» نباید بیشتر از ${rule.max} باشد`);
    return;
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") fail(`«${label}» باید بله/خیر باشد`);
    return;
  }
  if (type === "date") {
    if (Number.isNaN(new Date(value).getTime())) fail(`«${label}» تاریخ معتبر نیست`);
    return;
  }
  if (type === "url") {
    try {
      const u = new URL(String(value));
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      fail(`«${label}» نشانی معتبر نیست`);
    }
    return;
  }
  if (type === "select" && Array.isArray(rule.options) && rule.options.length) {
    const allowed = rule.options.map((o) => String(o?.value ?? o));
    if (!allowed.includes(String(value))) fail(`«${label}» مقدار مجاز نیست`);
    return;
  }
  if (typeof value === "string") {
    if (rule.minLength != null && value.trim().length < rule.minLength)
      return fail(`«${label}» باید حداقل ${rule.minLength} نویسه باشد`);
    if (rule.maxLength != null && value.length > rule.maxLength)
      return fail(`«${label}» نباید بیشتر از ${rule.maxLength} نویسه باشد`);
    if (rule.pattern) {
      let re = null;
      try {
        re = new RegExp(rule.pattern);
      } catch {
        re = null; // a broken pattern in config is a config bug, not the admin's
      }
      if (re && !re.test(value)) fail(rule.patternMessage || `«${label}» قالب درستی ندارد`);
    }
  }
}

/**
 * Validate a product (the *effective* document: stored values merged with the
 * request) against the rules for a stage.
 *
 * @param {object} product
 * @param {object} rules   from resolveProductRules
 * @param {object} opts    { stage, variants }  variants: [{ price, stock }] for price/stock checks
 * @returns {{ error?: string, fieldErrors: object }}
 */
export function validateProductData(product, rules, { stage = "draft", variants = [] } = {}) {
  const fieldErrors = {};
  const fail = (key) => (message) => {
    if (!fieldErrors[key]) fieldErrors[key] = message;
  };

  for (const rule of Object.values(rules.fields)) {
    if (!rule.use) continue;
    const value = product?.[rule.key];
    if (requiredAt(rule, stage) && !present(rule.key, value, product, variants)) {
      fail(rule.key)(`«${rule.label}» الزامی است`);
      continue;
    }
    checkValue(rule, value, fail(rule.key));
  }

  const custom = product?.customFields && typeof product.customFields === "object" ? product.customFields : {};
  for (const rule of rules.customFields) {
    const value = custom[rule.key];
    const f = fail(`customFields.${rule.key}`);
    if (requiredAt(rule, stage) && isEmptyValue(value)) {
      f(`«${rule.label}» الزامی است`);
      continue;
    }
    checkValue(rule, value, f);
  }

  const error = Object.values(fieldErrors)[0];
  return error ? { error, fieldErrors } : { fieldErrors };
}

/**
 * Keys in a *request's* customFields that the rules do not define. Write paths
 * reject them (a typo must not be stored silently). Values already stored under
 * a key that was later removed from the config are not affected: requests
 * merge into stored customFields, they never replace them.
 */
export function unknownCustomFieldKeys(customFields, rules) {
  if (!customFields || typeof customFields !== "object") return [];
  const known = new Set(rules.customFields.map((f) => f.key));
  return Object.keys(customFields).filter((k) => !known.has(k));
}

/** Coerce form/import input to each custom field's type ("12" → 12, "true" → true). */
export function coerceCustomFields(customFields, rules) {
  const out = {};
  const byKey = new Map(rules.customFields.map((f) => [f.key, f]));
  for (const [key, raw] of Object.entries(customFields || {})) {
    const rule = byKey.get(key);
    if (!rule || raw === undefined) continue;
    if (raw === null || raw === "") {
      out[key] = null;
    } else if (rule.type === "number") {
      out[key] = typeof raw === "number" ? raw : Number(String(raw).trim());
    } else if (rule.type === "boolean") {
      out[key] = raw === true || raw === "true" || raw === 1 || raw === "1" ? true : raw === false || raw === "false" || raw === 0 || raw === "0" ? false : raw;
    } else {
      out[key] = typeof raw === "string" ? raw.trim() : raw;
    }
  }
  return out;
}

/** The stage a saved product is in. */
export function stageOf(product) {
  return product?.isActive === false ? "draft" : "published";
}

/**
 * Can this product (optionally: this variant of it) be bought right now?
 * @returns {{ purchasable: boolean, mode: "cart"|"inquiry"|"catalog", reasons: string[] }}
 */
export function purchaseStatus(product, rules, { variant = null, variants = null } = {}) {
  const reasons = [];
  const mode = rules.purchase;
  if (mode !== "cart") reasons.push(mode === "inquiry" ? "خرید این محصول با استعلام انجام می‌شود" : "این محصول فقط برای نمایش است");
  if (product?.isActive === false) reasons.push("این محصول منتشر نشده است");
  if (product?.purchasable === false) reasons.push("فروش این محصول متوقف شده است");

  const allVariants = variants || (Array.isArray(product?.variants) ? product.variants.filter((v) => v && typeof v === "object") : []);
  const priceSources = variant ? [variant] : allVariants;
  const { fieldErrors } = validateProductData(product, rules, { stage: "purchasable", variants: priceSources });
  for (const message of Object.values(fieldErrors)) reasons.push(message);

  if (rules.inventory === "stock") {
    const tracked = variant ? variant.stock : allVariants.length ? null : product?.stock;
    if (tracked != null && Number(tracked) <= 0) reasons.push("ناموجود");
    if (!variant && allVariants.length && allVariants.every((v) => v.stock != null && Number(v.stock) <= 0)) {
      reasons.push("ناموجود");
    }
  }

  return { purchasable: reasons.length === 0, mode, reasons: [...new Set(reasons)] };
}

const PUBLIC_STRIP_VALUE = {
  ref: null, refs: [], select: null, object: {}, text: "", textarea: "", html: "",
  image: "", images: [], number: null, tags: [],
};

/**
 * The product as a customer may see it: fields the store does not use, or
 * marks as internal, are blanked; internal custom fields and category
 * attributes are removed. Never mutates the input.
 *
 * @param {object} product
 * @param {object} rules
 * @param {object} [category] with `attributes` definitions (to drop internal ones)
 */
export function toPublicProduct(product, rules, category = null) {
  if (!product || typeof product !== "object") return product;
  const out = { ...product };
  for (const rule of Object.values(rules.fields)) {
    if (rule.key === "name" || rule.public) continue;
    if (!(rule.key in out)) continue;
    // stock is internal by default, but customers still need to know "available or not"
    if (rule.key === "stock") {
      delete out.stock;
      continue;
    }
    out[rule.key] = PUBLIC_STRIP_VALUE[rule.type] ?? null;
  }
  const publicCustom = new Set(rules.customFields.filter((f) => f.public).map((f) => f.key));
  const custom = out.customFields && typeof out.customFields === "object" ? out.customFields : {};
  out.customFields = Object.fromEntries(Object.entries(custom).filter(([k]) => publicCustom.has(k)));

  const attrDefs = category?.attributes || out.category?.attributes;
  if (Array.isArray(attrDefs) && out.attributes && typeof out.attributes === "object") {
    const hidden = new Set(attrDefs.filter((a) => a?.isPublic === false).map((a) => a.name));
    if (hidden.size) {
      out.attributes = Object.fromEntries(Object.entries(out.attributes).filter(([k]) => !hidden.has(k)));
    }
  }
  if (out.category && typeof out.category === "object" && Array.isArray(out.category.attributes)) {
    out.category = { ...out.category, attributes: out.category.attributes.filter((a) => a?.isPublic !== false) };
  }
  return out;
}

/**
 * Product paths the storefront search may match (core + custom fields). Admin
 * search is not limited by this.
 */
export function searchablePaths(rules = resolveProductRules()) {
  const core = Object.values(rules.fields)
    .filter((r) => r.searchable && ["text", "textarea", "tags"].includes(r.type))
    .map((r) => r.key);
  const custom = rules.customFields
    .filter((r) => r.searchable && ["text", "textarea", "select", "url"].includes(r.type))
    .map((r) => `customFields.${r.key}`);
  return ["name", "slug", ...core, ...custom];
}

/** Custom fields offered as storefront filters, in the shape category attributes use. */
export function filterableCustomFields(rules) {
  return rules.customFields
    .filter((r) => r.filterable)
    .map((r) => ({ name: r.key, label: r.label, filterable: true, options: (r.options || []).map((o) => String(o?.value ?? o)) }));
}
