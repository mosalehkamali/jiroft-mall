/**
 * Stock reservation for commerce.inventory.mode = "stock" (store.config.js).
 *
 * An order line reserves its variant's stock, or the product's when it has no
 * variant. `stock: null` means "not tracked" and is never touched, so a store
 * can track some products and not others.
 *
 *   checkout           reserveOrderStock   (all lines or none)
 *   cancel             releaseOrderStock
 *   un-cancel          reserveOrderStock   (fails if the stock is gone)
 *   delete             releaseOrderStock   (if still reserved)
 *
 * order.inventoryReserved records whether this order currently holds stock,
 * so releasing twice — or releasing an order placed before stock tracking was
 * switched on — is impossible.
 */
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import storeConfig from "base/store.config";

export const inventoryTracked = () => storeConfig.commerce?.inventory?.mode === "stock";

export class InventoryError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

/** Order items → stock movements, quantities merged per document. */
function movements(items) {
  const byKey = new Map();
  for (const item of items || []) {
    if (item.itemType === "used_product") continue;
    const variant = item.variant?._id || item.variant;
    const product = item.product?._id || item.product;
    if (!variant && !product) continue;
    const key = variant ? `v:${variant}` : `p:${product}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      Model: variant ? Variant : Product,
      id: variant || product,
      qty: (prev?.qty || 0) + Math.max(1, Number(item.quantity) || 1),
    });
  }
  return [...byKey.values()];
}

/**
 * Decrement stock for every tracked line, atomically per document; if any line
 * is short, every decrement already made is put back and nothing is reserved.
 * @returns {boolean} true when stock tracking applies (the order now holds stock)
 */
export async function reserveOrderStock(items, { session = null } = {}) {
  if (!inventoryTracked()) return false;
  const done = [];
  try {
    for (const m of movements(items)) {
      const res = await m.Model.updateOne(
        { _id: m.id, stock: { $ne: null, $gte: m.qty } },
        { $inc: { stock: -m.qty } },
        session ? { session } : {},
      );
      if (res.modifiedCount === 1) {
        done.push(m);
        continue;
      }
      const doc = await m.Model.findById(m.id).select("stock").lean();
      if (doc && doc.stock == null) continue; // not tracked
      throw new InventoryError(
        doc ? `موجودی کافی نیست (موجود: ${doc.stock})` : "یکی از کالاهای سفارش دیگر وجود ندارد",
      );
    }
    return true;
  } catch (err) {
    for (const m of done) {
      await m.Model.updateOne({ _id: m.id }, { $inc: { stock: m.qty } }, session ? { session } : {});
    }
    throw err;
  }
}

/** Put the stock of an order's tracked lines back. */
export async function releaseOrderStock(items, { session = null } = {}) {
  for (const m of movements(items)) {
    await m.Model.updateOne(
      { _id: m.id, stock: { $ne: null } },
      { $inc: { stock: m.qty } },
      session ? { session } : {},
    );
  }
}
