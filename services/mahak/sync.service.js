/**
 * services/mahak/sync.service.js — Mahak → site.
 *
 *   pull      rows newer than the stored rowVersions (per account, per entity)
 *   mirror    stored verbatim in MahakRow
 *   build     every Mahak product that changed becomes / updates one site
 *             Product (+ one Variant per detail when it has properties or more
 *             than one detail); MahakLink records which is which
 *   stock     site stock = Mahak stock − quantities held by site orders that
 *             Mahak does not know about yet
 *   show      a linked product is published exactly when it has a main image
 *             and something in stock
 *
 * The site owns: images, descriptions, slug, brand, and (after creation) the
 * category. Mahak owns: name, price, stock, which variants exist.
 *
 * Nothing here deletes a Product or a Variant: a variant's _id is referenced
 * by orders, so a detail that disappears in Mahak is marked `gone` and sold out.
 *
 * Every step is idempotent and re-runnable; a product whose build failed (or
 * did not fit in the time budget) stays in MahakAccount.dirty for the next run.
 */
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Order from "base/models/Order";
import SlugRegistry from "base/models/SlugRegistery";
import { MahakAccount, MahakLink, MahakRow } from "base/models/Mahak";
import { createSlug } from "base/utils/slugify";
import { isFeatureEnabled } from "@/lib/features";
import { MAHAK, accountCredentials, mahakAccountKeys, mahakAccountLabel } from "@/lib/mahak/config";
import { ENTITIES, STOCK_ENTITIES, pullAll } from "@/lib/mahak/client";
import { mahakStock, planProduct } from "@/lib/mahak/mapping";

export const mahakEnabled = () => isFeatureEnabled("mahak") && mahakAccountKeys().length > 0;

const rowData = (r) => ({ ...r.data, deleted: !!r.deleted });

/* ── mirror ───────────────────────────────────────────────────────────── */

async function mirror(account, rows) {
  for (const [entity, list] of Object.entries(rows)) {
    if (!list.length) continue;
    const idField = ENTITIES[entity].id;
    await MahakRow.bulkWrite(
      list
        .filter((r) => r?.[idField] != null)
        .map((r) => ({
          updateOne: {
            filter: { account, entity, id: r[idField] },
            update: { $set: { data: r, deleted: !!r.deleted } },
            upsert: true,
          },
        })),
      { ordered: false },
    );
  }
}

/** Mahak productIds whose site shape may have changed because of these rows. */
async function affectedProducts(account, rows) {
  const ids = new Set();
  for (const r of rows.products || []) ids.add(r.productId);
  for (const r of rows.productDetails || []) ids.add(r.productId);
  const detailIds = (rows.visitorProducts || []).map((r) => r.productDetailId).filter((v) => v != null);
  if (detailIds.length) {
    const details = await MahakRow.find({ account, entity: "productDetails", id: { $in: detailIds } })
      .select("data.productId")
      .lean();
    for (const d of details) ids.add(d.data?.productId);
  }
  ids.delete(undefined);
  ids.delete(null);
  return [...ids];
}

/* ── categories ───────────────────────────────────────────────────────── */

/** The site category of a Mahak product group (created on first use). */
async function siteCategory(account, mahakCategoryId) {
  const row = mahakCategoryId
    ? await MahakRow.findOne({ account, entity: "productCategories", id: mahakCategoryId })
    : null;
  if (row?.siteRef) {
    const linked = await Category.findById(row.siteRef);
    if (linked) return linked;
  }
  const title = String(row?.data?.name || "").trim() || mahakAccountLabel(account);
  // an admin-made (or other account's) category with the same title is reused
  let category = await Category.findOne({ title });
  if (!category) {
    const name = `mahak-${account}-${mahakCategoryId || "all"}`;
    const wanted = createSlug(title);
    // root category slugs share the URL root with brands
    const taken =
      !wanted || (await Category.exists({ slug: wanted, sport: null })) || (await Brand.exists({ slug: wanted }));
    const last = await Category.findOne({ sport: null }).sort({ order: -1 }).select("order").lean();
    category = await Category.create({
      title,
      name,
      slug: taken ? createSlug(name) : wanted,
      order: (last?.order ?? -1) + 1,
    });
    await SlugRegistry.create({
      slug: category.slug,
      type: "category",
      model: "Category",
      refId: category._id,
      filterField: "category",
      filterValue: category._id,
      label: category.title,
    }).catch(() => {});
  }
  if (row) {
    row.siteRef = category._id;
    await row.save();
  }
  return category;
}

/** Variant.pre("validate") only accepts attributes the category declares. */
async function ensureVariantAttributes(categoryId, names) {
  const category = await Category.findById(categoryId);
  if (!category) return;
  const have = new Set(category.variantAttributes.map((a) => a.name));
  const missing = names.filter((n) => !have.has(n));
  if (!missing.length) return;
  for (const name of missing) {
    // optional: products of one category need not share the same properties
    category.variantAttributes.push({ name, label: name, uiType: "button-toggle", required: false });
  }
  await category.save();
}

/* ── build one product ────────────────────────────────────────────────── */

const sameAttributes = (map, obj) => {
  const cur = Object.fromEntries(map || []);
  const keys = Object.keys(obj);
  return keys.length === Object.keys(cur).length && keys.every((k) => cur[k] === obj[k]);
};

export async function buildProduct(account, productId, { hasVisitorProducts }) {
  const [pRow, dRows] = await Promise.all([
    MahakRow.findOne({ account, entity: "products", id: productId }).lean(),
    MahakRow.find({ account, entity: "productDetails", "data.productId": productId }).lean(),
  ]);
  let assignedIds = null;
  if (hasVisitorProducts) {
    const vps = await MahakRow.find({
      account,
      entity: "visitorProducts",
      deleted: false,
      "data.productDetailId": { $in: dRows.map((d) => d.id) },
    })
      .select("data.productDetailId")
      .lean();
    assignedIds = new Set(vps.map((v) => v.data.productDetailId));
  }
  const plan = planProduct(pRow && rowData(pRow), dRows.map(rowData), {
    assigned: (id) => !assignedIds || assignedIds.has(id),
    level: MAHAK.priceLevel,
    divisor: MAHAK.priceDivisor,
    buyLevel: MAHAK.buyPriceLevel,
  });

  let links = await MahakLink.find({ account, productId });
  let product = links.length ? await Product.findById(links[0].product) : null;
  if (links.length && !product) {
    // the site product was removed by hand — Mahak still has it, so start over
    await MahakLink.deleteMany({ account, productId });
    links = [];
  }

  if (!plan) {
    if (links.length) await MahakLink.updateMany({ account, productId }, { $set: { gone: true } });
    return product?._id || null;
  }

  const basePrice = Math.min(...plan.lines.map((l) => l.price));
  const useVariants = plan.hasVariants || links.some((l) => l.variant);
  const sku = `MHK-${account}-${productId}`;

  if (!product) {
    product = await Product.findOne({ sku }); // re-adopt after a lost link
    if (!product) {
      const category = await siteCategory(account, plan.categoryId);
      product = await Product.create({
        name: plan.name,
        sku,
        basePrice,
        category: category._id,
        isActive: false, // published by refreshStock once it has an image and stock
        stock: useVariants ? null : 0,
      });
    }
  }
  if (!product.category) {
    product.category = (await siteCategory(account, plan.categoryId))._id;
  }
  // updateOne on purpose: the name changes without moving the product's URL (slug)
  await Product.updateOne(
    { _id: product._id },
    { $set: { name: plan.name, basePrice, category: product.category, ...(useVariants ? { stock: null } : {}) } },
  );

  const byDetail = new Map(links.map((l) => [l.productDetailId, l]));
  const variantIds = [];
  if (useVariants) {
    await ensureVariantAttributes(product.category, plan.attributeNames);
    for (const line of plan.lines) {
      const variantSku = `${sku}-${line.productDetailId}`;
      const link = byDetail.get(line.productDetailId);
      let variant =
        (link?.variant && (await Variant.findById(link.variant))) || (await Variant.findOne({ sku: variantSku }));
      const hasAttrs = Object.keys(line.attributes).length > 0;
      if (!variant) {
        variant = new Variant({
          productId: product._id,
          categoryId: product.category,
          sku: variantSku,
          attributes: line.attributes,
          price: line.price,
          stock: 0,
        });
      } else {
        // attributes are the variant's identity on the site: touched only when Mahak's really changed
        if (hasAttrs && !sameAttributes(variant.attributes, line.attributes)) variant.attributes = line.attributes;
        variant.price = line.price;
        variant.categoryId = product.category;
      }
      await variant.save(); // save(), not updateOne: the category check in pre("validate") must run
      line.variantId = variant._id;
      variantIds.push(variant._id);
    }
    await Product.updateOne({ _id: product._id }, { $addToSet: { variants: { $each: variantIds } } });
  }

  await MahakLink.bulkWrite(
    plan.lines.map((line) => ({
      updateOne: {
        filter: { account, productDetailId: line.productDetailId },
        update: {
          $set: {
            productId,
            product: product._id,
            variant: line.variantId || null,
            barcode: line.barcode,
            price: line.price,
            buyPrice: line.buyPrice,
            gone: false,
          },
        },
        upsert: true,
      },
    })),
  );
  await MahakLink.updateMany(
    { account, productId, productDetailId: { $nin: plan.lines.map((l) => l.productDetailId) } },
    { $set: { gone: true } },
  );
  return product._id;
}

/* ── stock + visibility ───────────────────────────────────────────────── */

/**
 * Quantities the site has promised but Mahak has not deducted yet: orders
 * holding stock whose invoice is not posted, or was posted less than
 * `reservationHoldMinutes` ago. Keys: "v:<variantId>" / "p:<productId>".
 */
async function heldQuantities() {
  const since = new Date(Date.now() - MAHAK.reservationHoldMinutes * 60000);
  // ponytail: scans every stock-holding order not yet invoiced; add an index on
  // { inventoryReserved, "mahak.state" } if the orders collection grows large
  const orders = await Order.find({
    inventoryReserved: true,
    fulfillmentStatus: { $ne: "CANCELED" },
    $or: [{ "mahak.state": { $ne: "done" } }, { "mahak.doneAt": { $gt: since } }],
  })
    .select("items.product items.variant items.quantity items.itemType")
    .lean();
  const held = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.itemType === "used_product") continue;
      const key = item.variant ? `v:${item.variant}` : item.product ? `p:${item.product}` : null;
      if (key) held.set(key, (held.get(key) || 0) + (Number(item.quantity) || 1));
    }
  }
  return held;
}

/**
 * Recompute stock of the linked items matching `filter` (default: all), then
 * publish/unpublish their products.
 * ponytail: absolute writes — a checkout reserving in the same milliseconds can
 * be overwritten once; the next run corrects it and the admin reviews every order.
 * @returns {{ items: number, changed: number }}
 */
export async function refreshStock(filter = {}) {
  const links = await MahakLink.find(filter).lean();
  if (!links.length) return { items: 0, changed: 0 };
  const held = await heldQuantities();
  let changed = 0;

  const byAccount = Map.groupBy(links, (l) => l.account);
  for (const [account, list] of byAccount) {
    const detailIds = list.map((l) => l.productDetailId);
    const [vps, assets, accountHasAssets] = await Promise.all([
      MahakRow.find({ account, entity: "visitorProducts", "data.productDetailId": { $in: detailIds } }).lean(),
      MahakRow.find({ account, entity: "productDetailStoreAssets", "data.productDetailId": { $in: detailIds } }).lean(),
      MahakRow.exists({ account, entity: "productDetailStoreAssets" }),
    ]);
    const vpBy = new Map(vps.filter((r) => !r.deleted).map((r) => [r.data.productDetailId, rowData(r)]));
    const assetsBy = Map.groupBy(assets.map(rowData), (a) => a.productDetailId);

    const linkOps = [];
    const variantOps = [];
    const productOps = [];
    for (const link of list) {
      const inMahak = link.gone
        ? 0
        : mahakStock({
            visitorProduct: vpBy.get(link.productDetailId),
            assets: assetsBy.get(link.productDetailId) || [],
            source: MAHAK.stockSource,
            storeIds: MAHAK.storeIds?.[account] || null,
            accountHasAssets: !!accountHasAssets,
          });
      const key = link.variant ? `v:${link.variant}` : `p:${link.product}`;
      const stock = Math.max(0, inMahak - (held.get(key) || 0));
      linkOps.push({ updateOne: { filter: { _id: link._id }, update: { $set: { mahakStock: inMahak, stock } } } });
      (link.variant ? variantOps : productOps).push({
        updateOne: { filter: { _id: link.variant || link.product, stock: { $ne: stock } }, update: { $set: { stock } } },
      });
    }
    await MahakLink.bulkWrite(linkOps, { ordered: false });
    if (variantOps.length) changed += (await Variant.bulkWrite(variantOps, { ordered: false })).modifiedCount;
    if (productOps.length) changed += (await Product.bulkWrite(productOps, { ordered: false })).modifiedCount;
  }

  changed += await applyVisibility([...new Set(links.map((l) => String(l.product)))]);
  return { items: links.length, changed };
}

/**
 * A Mahak-linked product is on the storefront exactly when it has a main image
 * and at least one sellable unit. (Products without a link are never touched.)
 * @returns number of products whose visibility changed
 */
export async function applyVisibility(productIds) {
  if (!productIds.length) return 0;
  const [links, products] = await Promise.all([
    MahakLink.find({ product: { $in: productIds } }).select("product stock gone").lean(),
    Product.find({ _id: { $in: productIds } }).select("mainImage isActive").lean(),
  ]);
  const inStock = new Set(links.filter((l) => !l.gone && l.stock > 0).map((l) => String(l.product)));
  const linked = new Set(links.map((l) => String(l.product)));
  const show = [];
  const hide = [];
  for (const p of products) {
    if (!linked.has(String(p._id))) continue;
    const visible = !!String(p.mainImage || "").trim() && inStock.has(String(p._id));
    if (visible !== (p.isActive !== false)) (visible ? show : hide).push(p._id);
  }
  if (show.length) await Product.updateMany({ _id: { $in: show } }, { $set: { isActive: true } });
  if (hide.length) await Product.updateMany({ _id: { $in: hide } }, { $set: { isActive: false } });
  return show.length + hide.length;
}

/**
 * After an admin saved a product: if it is Mahak-linked, put Mahak's stock back
 * (the form may have sent its own) and re-decide visibility — uploading the
 * main image is what publishes a product that is in stock.
 */
export async function afterMahakProductEdit(productId) {
  if (!mahakEnabled()) return;
  try {
    await refreshStock({ product: productId });
  } catch (err) {
    console.error("[mahak] refresh after product edit failed:", err?.message);
  }
}

/* ── sync ─────────────────────────────────────────────────────────────── */

/**
 * @param key  account key
 * @param opts.stockOnly  pull only stock rows and build nothing (checkout)
 * @param opts.deadline   Date.now() value after which no new product is built
 */
export async function syncAccount(key, { stockOnly = false, deadline = Infinity, timeoutMs } = {}) {
  if (!accountCredentials(key)) return { key, skipped: "not-configured" };
  const state = await MahakAccount.findOneAndUpdate(
    { key },
    { $setOnInsert: { key } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  const entities = stockOnly ? STOCK_ENTITIES : Object.keys(ENTITIES);
  const { rows, versions, visitorId } = await pullAll(key, entities, state.versions || {}, { timeoutMs });
  await mirror(key, rows);
  const pulled = Object.fromEntries(entities.map((e) => [e, rows[e].length]));

  // cursors move only after the rows are stored; what still has to be built is queued
  const affected = await affectedProducts(key, rows);
  await MahakAccount.updateOne(
    { key },
    {
      $set: {
        visitorId,
        ...Object.fromEntries(entities.map((e) => [`versions.${e}`, versions[e]])),
        [stockOnly ? "lastStockSyncAt" : "lastSyncAt"]: new Date(),
        ...(stockOnly ? {} : { lastError: "" }),
      },
      ...(affected.length ? { $addToSet: { dirty: { $each: affected } } } : {}),
    },
  );
  if (stockOnly) return { key, pulled };

  const queue = [...new Set([...(state.dirty || []), ...affected])];
  const hasVisitorProducts = !!(await MahakRow.exists({ account: key, entity: "visitorProducts" }));
  let built = 0;
  const errors = [];
  for (const productId of queue) {
    if (Date.now() > deadline) break;
    try {
      await buildProduct(key, productId, { hasVisitorProducts });
      await MahakAccount.updateOne({ key }, { $pull: { dirty: productId } });
      built++;
    } catch (err) {
      errors.push(`کالای ${productId}: ${err?.message || err}`);
    }
  }
  const result = { key, pulled, built, remaining: queue.length - built, errors: errors.slice(0, 20) };
  await MahakAccount.updateOne({ key }, { $set: { lastResult: result, lastError: errors[0] || "" } });
  return result;
}

/**
 * The hourly job (and the admin's "sync now"): every configured account, then
 * stock and visibility of everything linked.
 */
export async function runMahakSync({ budgetMs = 45000 } = {}) {
  if (!mahakEnabled()) return { enabled: false };
  const deadline = Date.now() + budgetMs;
  const accounts = [];
  for (const key of mahakAccountKeys()) {
    try {
      accounts.push(await syncAccount(key, { deadline }));
    } catch (err) {
      const message = err?.message || String(err);
      await MahakAccount.updateOne({ key }, { $set: { lastError: message } }, { upsert: true });
      accounts.push({ key, error: message });
    }
  }
  const stock = await refreshStock();
  return { enabled: true, accounts, stock, changed: stock.changed > 0 || accounts.some((a) => a.built > 0) };
}

/* ── checkout ─────────────────────────────────────────────────────────── */

const STOCK_PULL_THROTTLE_MS = 15000;

/**
 * Called when the customer is about to pay: pull fresh stock for the accounts
 * in this cart, recompute, and report what cannot be fulfilled.
 * Mahak being unreachable does not block the sale — the last known stock is used.
 *
 * @param items [{ product|productId, variant|variantId, quantity, itemType }]
 * @returns shortages [{ productId, variantId, name, requested, available }]  ([] = ok)
 */
export async function checkMahakStock(items) {
  if (!mahakEnabled()) return [];
  const wanted = new Map();
  for (const item of items || []) {
    if (item.itemType === "used_product" || item.usedProductId) continue;
    const variant = item.variant?._id || item.variant || item.variantId || null;
    const product = item.product?._id || item.product || item.productId || null;
    if (!variant && !product) continue;
    const key = variant ? `v:${variant}` : `p:${product}`;
    const prev = wanted.get(key);
    wanted.set(key, { variant, product, qty: (prev?.qty || 0) + Math.max(1, Number(item.quantity) || 1) });
  }
  const variantIds = [...wanted.values()].filter((w) => w.variant).map((w) => w.variant);
  const productIds = [...wanted.values()].filter((w) => !w.variant).map((w) => w.product);
  const filter = { $or: [{ variant: { $in: variantIds } }, { product: { $in: productIds }, variant: null }] };
  let links = await MahakLink.find(filter).select("account").lean();
  if (!links.length) return [];

  const states = await MahakAccount.find({ key: { $in: links.map((l) => l.account) } })
    .select("key lastStockSyncAt")
    .lean();
  const fresh = new Set(
    states.filter((s) => s.lastStockSyncAt && Date.now() - s.lastStockSyncAt < STOCK_PULL_THROTTLE_MS).map((s) => s.key),
  );
  await Promise.all(
    [...new Set(links.map((l) => l.account))]
      .filter((key) => !fresh.has(key))
      .map((key) =>
        syncAccount(key, { stockOnly: true, timeoutMs: 8000 }).catch((err) =>
          console.error(`[mahak] stock pull failed for ${key}:`, err?.message),
        ),
      ),
  );
  await refreshStock(filter);

  links = await MahakLink.find(filter).select("product variant stock gone").lean();
  const short = [];
  for (const link of links) {
    const want = wanted.get(link.variant ? `v:${link.variant}` : `p:${link.product}`);
    if (!want) continue;
    const available = link.gone ? 0 : link.stock;
    if (available < want.qty) {
      short.push({ productId: String(link.product), variantId: link.variant ? String(link.variant) : null, requested: want.qty, available });
    }
  }
  if (short.length) {
    const names = await Product.find({ _id: { $in: short.map((s) => s.productId) } }).select("name").lean();
    const nameOf = new Map(names.map((p) => [String(p._id), p.name]));
    for (const s of short) s.name = nameOf.get(s.productId) || "";
  }
  return short;
}

/** One Persian sentence for the customer. */
export function shortageMessage(short) {
  return short
    .map((s) => (s.available > 0 ? `از «${s.name}» فقط ${s.available} عدد موجود است` : `«${s.name}» در حال حاضر موجود نیست`))
    .join("؛ ");
}
