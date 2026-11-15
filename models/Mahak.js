/**
 * models/Mahak.js — storage of the Mahak accounting integration.
 *
 *   MahakAccount  one per configured account: sync cursors (rowVersion per
 *                 entity), last run, the invoice number sequence.
 *   MahakRow      a verbatim mirror of the Mahak rows the site reads. Sync is
 *                 incremental, so a changed detail arrives without its product;
 *                 the mirror is what lets the site rebuild a product from parts.
 *   MahakLink     Mahak detail ↔ site product/variant. Kept outside Product so
 *                 no Mahak id (or purchase price) can ever reach a customer.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const MahakAccountSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    visitorId: { type: Number, default: null },
    versions: { type: Schema.Types.Mixed, default: {} },
    orderSeq: { type: Number, default: null },
    // Mahak productIds pulled but not built into site products yet
    dirty: { type: [Number], default: [] },
    lastSyncAt: { type: Date, default: null },
    lastStockSyncAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    lastResult: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, minimize: false },
);

const MahakRowSchema = new Schema(
  {
    account: { type: String, required: true },
    entity: { type: String, required: true },
    id: { type: Number, required: true },
    deleted: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed, default: {} },
    // productCategories only: the site category this group maps to
    siteRef: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
MahakRowSchema.index({ account: 1, entity: 1, id: 1 }, { unique: true });
MahakRowSchema.index({ account: 1, entity: 1, "data.productId": 1 });
MahakRowSchema.index({ account: 1, entity: 1, "data.productDetailId": 1 });

const MahakLinkSchema = new Schema(
  {
    account: { type: String, required: true },
    productId: { type: Number, required: true }, // Mahak productId
    productDetailId: { type: Number, required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variant: { type: Schema.Types.ObjectId, ref: "Variant", default: null, index: true },
    barcode: { type: String, default: "" },
    price: { type: Number, default: 0 }, // site currency
    buyPrice: { type: Number, default: null },
    mahakStock: { type: Number, default: 0 }, // what Mahak reports
    stock: { type: Number, default: 0 }, // what the site sells: mahakStock − held orders
    // the detail was deleted / unassigned in Mahak — the variant is kept (its
    // _id is referenced by orders) with stock 0
    gone: { type: Boolean, default: false },
  },
  { timestamps: true },
);
MahakLinkSchema.index({ account: 1, productDetailId: 1 }, { unique: true });
MahakLinkSchema.index({ account: 1, productId: 1 });

export const MahakAccount = mongoose.models.MahakAccount || mongoose.model("MahakAccount", MahakAccountSchema);
export const MahakRow = mongoose.models.MahakRow || mongoose.model("MahakRow", MahakRowSchema);
export const MahakLink = mongoose.models.MahakLink || mongoose.model("MahakLink", MahakLinkSchema);
