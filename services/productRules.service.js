/**
 * Server side of src/lib/productRules.js: resolves which per-category rules
 * (store.config.js → catalog.product.categoryRules, keyed by slug) apply to a
 * product, by walking the category's parents.
 */
import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { resolveProductRules } from "@/lib/productRules";

// ponytail: one small query per call (slug + parent of every category); cache
// it with the `categories` tag if catalogues ever reach thousands of categories.
async function loadCategoryIndex() {
  await connectToDB();
  const rows = await Category.find({}).select("_id slug parent").lean();
  return new Map(rows.map((r) => [String(r._id), { slug: r.slug, parent: r.parent ? String(r.parent) : null }]));
}

function chainFrom(index, categoryId) {
  const chain = [];
  const seen = new Set();
  let id = categoryId ? String(categoryId?._id || categoryId) : null;
  while (id && index.has(id) && !seen.has(id)) {
    seen.add(id);
    const row = index.get(id);
    chain.unshift(row.slug);
    id = row.parent;
  }
  return chain;
}

/** Rules for one category id (or a populated category). */
export async function rulesForCategory(categoryId) {
  if (!categoryId) return resolveProductRules([]);
  return resolveProductRules(chainFrom(await loadCategoryIndex(), categoryId));
}

/**
 * One index load, then a synchronous resolver for many products — use this
 * for listings: `const rulesOf = await rulesResolver(); rulesOf(product.category)`.
 */
export async function rulesResolver() {
  const index = await loadCategoryIndex();
  const memo = new Map();
  return (category) => {
    const id = category ? String(category?._id || category) : "";
    if (!memo.has(id)) memo.set(id, resolveProductRules(id ? chainFrom(index, id) : []));
    return memo.get(id);
  };
}
