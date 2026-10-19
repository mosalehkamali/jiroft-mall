/**
 * Product create — the one write path behind POST /api/product/create and the
 * bulk import (POST /api/product/import). Both used to be one inline route;
 * sharing it is what keeps "a product the admin form rejects" and "a product
 * an import rejects" the same set.
 *
 * Validation order: category & relations → variant dimensions → category
 * attributes → store rules (store.config.js, src/lib/productRules.js) at the
 * product's stage (draft / published).
 */
import "base/models/registerModels";
import connectToDB from "base/configs/db";
import mongoose from "mongoose";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Variant from "base/models/Variant";
import { createSlug } from "base/utils/slugify";
import { makeComboKey } from "@/lib/variantKey";
import { validateProductVariants, validateProductFields } from "@/lib/productVariantValidation";
import { createProductWithVariants } from "@/lib/createProductWithVariants";
import { normalizeTargetAudience } from "base/utils/targetAudience";
import { resolveProductLimitedEdition } from "@/lib/limitedEditionRelations";
import {
  coerceCustomFields,
  unknownCustomFieldKeys,
  validateProductData,
} from "@/lib/productRules";
import { rulesForCategory } from "base/services/productRules.service";

export class ProductInputError extends Error {
  constructor(message, status = 400, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const fail = (message, status = 400, fieldErrors = {}) => {
  throw new ProductInputError(message, status, fieldErrors);
};

async function generateUniqueSKU(name) {
  const base = createSlug(name) || "item";
  for (;;) {
    const sku = `${base}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    if (!(await Product.exists({ sku }))) return sku;
  }
}

/** An id, or (for imports) a slug of a document of `Model`. */
async function resolveRef(Model, value, label, key) {
  if (value === undefined || value === null || value === "") return null;
  const doc = mongoose.isValidObjectId(value)
    ? await Model.findById(value).lean()
    : await Model.findOne({ slug: String(value).trim() }).lean();
  if (!doc) fail(`${label} «${value}» یافت نشد`, 404, { [key]: `${label} انتخاب‌شده یافت نشد` });
  return doc;
}

const toTags = (tag) =>
  Array.isArray(tag) ? tag.map(String).filter(Boolean) : typeof tag === "string" ? tag.split(",").map((t) => t.trim()).filter(Boolean) : [];

/**
 * @param {object} body     the admin form / import row payload
 * @param {object} options  { dryRun } validate everything, write nothing
 * @returns the created product (or, with dryRun, the data that would be saved)
 */
export async function createProductFromPayload(body, { dryRun = false } = {}) {
  await connectToDB();
  if (!body || typeof body !== "object") fail("داده‌ی محصول معتبر نیست");

  const {
    name, shortDescription, longDescription, color, basePrice, tag, mainImage, gallery,
    serie, limitedEdition, athlete, sport, attributes, technicalStats, customTabItems,
    label, targetAudience, isActive, variantOptions, variantDetails, selectedCombos,
    variantMeta, customFields, stock, purchasable, sku,
  } = body;

  const foundCategory = await resolveRef(Category, body.category, "دسته‌بندی", "category");
  const foundBrand = await resolveRef(Brand, body.brand, "برند", "brand");
  const rules = await rulesForCategory(foundCategory?._id);
  const stage = isActive === false ? "draft" : "published";

  const normalizedTargetAudience = normalizeTargetAudience(targetAudience);
  if (targetAudience != null && targetAudience !== "" && !normalizedTargetAudience) {
    fail("«مخاطب هدف» نامعتبر است", 400, { targetAudience: "مخاطب هدف انتخاب‌شده معتبر نیست" });
  }

  const resolvedLimitedEdition = await resolveProductLimitedEdition(limitedEdition, foundBrand?._id);
  if (resolvedLimitedEdition.error) {
    fail(resolvedLimitedEdition.error, resolvedLimitedEdition.status, { limitedEdition: resolvedLimitedEdition.error });
  }

  const hasVariantInput = variantOptions && typeof variantOptions === "object" && Object.keys(variantOptions).length > 0;
  if (!foundCategory && hasVariantInput) {
    fail("واریانت فقط برای محصولی که دسته‌بندی دارد تعریف می‌شود", 400, { category: "برای واریانت‌ها دسته‌بندی را انتخاب کنید" });
  }
  const variantValidation = foundCategory
    ? validateProductVariants(foundCategory.variantAttributes, variantOptions || {}, selectedCombos, { allowEmpty: stage === "draft" })
    : { combinations: [] };
  if (variantValidation.error) fail(variantValidation.error, 400, variantValidation.fieldErrors);

  let resolvedCustomTabItemIds = [];
  if (foundCategory && Array.isArray(customTabItems) && customTabItems.length > 0) {
    const categoryItems = foundCategory.customTab?.items || [];
    resolvedCustomTabItemIds = customTabItems
      .map((title) => categoryItems.find((it) => it.title === title)?._id)
      .filter(Boolean);
  }

  const fieldValidation = validateProductFields(foundCategory, {
    attributes: attributes || {},
    technicalStats: technicalStats || {},
    basePrice,
    targetAudience: normalizedTargetAudience,
    stage,
  });
  if (fieldValidation.error) fail(fieldValidation.error, 400, fieldValidation.fieldErrors);

  const unknown = unknownCustomFieldKeys(customFields, rules);
  if (unknown.length) {
    fail(`فیلدهای تعریف‌نشده: ${unknown.join("، ")}`, 400, Object.fromEntries(unknown.map((k) => [`customFields.${k}`, "این فیلد در تنظیمات فروشگاه تعریف نشده است"])));
  }

  const variants = variantValidation.combinations.map((combo) => {
    const detail = variantDetails?.[makeComboKey(combo)];
    const variantStock = detail?.stock === "" || detail?.stock == null ? null : Number(detail.stock);
    return {
      categoryId: foundCategory._id,
      attributes: combo,
      price: detail?.price ? Number(detail.price) : Number(basePrice) || 0,
      images: Array.isArray(detail?.images) ? detail.images : [],
      stock: Number.isFinite(variantStock) ? variantStock : null,
    };
  });

  const productData = {
    name: typeof name === "string" ? name.trim() : name,
    shortDescription: shortDescription || "",
    longDescription: longDescription || "",
    color: color || "",
    basePrice: basePrice === "" || basePrice == null ? 0 : Number(basePrice),
    category: foundCategory?._id || null,
    tag: toTags(tag),
    mainImage: mainImage || "",
    gallery: Array.isArray(gallery) ? gallery : [],
    brand: foundBrand?._id || null,
    serie: serie || null,
    limitedEdition: resolvedLimitedEdition.value || null,
    athlete: Array.isArray(athlete) ? athlete : typeof athlete === "string" && athlete.trim() ? [athlete] : [],
    sport: sport || foundCategory?.sport || null,
    attributes: attributes || {},
    technicalStats: technicalStats || {},
    customTabItems: resolvedCustomTabItemIds,
    customFields: coerceCustomFields(customFields, rules),
    variantMeta: variantMeta && typeof variantMeta === "object" ? variantMeta : {},
    label: label || "none",
    targetAudience: normalizedTargetAudience,
    stock: stock === "" || stock == null ? null : Number(stock),
    purchasable: purchasable !== false,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  };

  const ruleCheck = validateProductData(productData, rules, { stage, variants });
  if (ruleCheck.error) fail(ruleCheck.error, 400, ruleCheck.fieldErrors);

  const requestedSku = typeof sku === "string" ? sku.trim() : "";
  if (requestedSku && rules.fields.sku.use) {
    if (await Product.exists({ sku: requestedSku })) {
      fail("این کد کالا (SKU) قبلاً استفاده شده است", 409, { sku: "کد کالا تکراری است" });
    }
    productData.sku = requestedSku;
  } else {
    productData.sku = await generateUniqueSKU(productData.name);
  }

  if (dryRun) return { ...productData, variants };
  return createProductWithVariants({ Product, Variant, productData, variants });
}
