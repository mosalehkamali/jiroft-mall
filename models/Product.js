import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";
import { TARGET_AUDIENCE_VALUES } from "base/utils/targetAudience";

/*
 * Only what every store needs is required here: a name (and the sku/slug
 * derived from it). Everything else is store policy — which fields exist,
 * which are required for a draft, a published or a purchasable product, what
 * customers see — and lives in store.config.js (catalog.product), enforced by
 * src/lib/productRules.js on every write path (admin create/edit, import) and
 * at checkout.
 */
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    shortDescription: { type: String, default: "" },

    longDescription: { type: String, default: "" },

    color: { type: String },

    score: { type: Number, default: 0 },

    basePrice: { type: Number, default: 0 },

    label: {
      type: String,
      enum: ["none", "new", "hot", "discount", "limited"],
      default: "none",
    },

    // مخاطبِ هدف — مستقل از مکانیزمِ Category.megaMenuFilterAttribute.
    // فعلاً اختیاری (Stage 1)؛ پس از Backfill کاملِ داده‌های قدیمی، required می‌شود (Stage 4).
    targetAudience: {
      type: String,
      enum: TARGET_AUDIENCE_VALUES,
      default: null,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
      default: null,
    },

    tag: [String],

    // Generated from the name when not given (see pre("validate") below).
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    mainImage: { type: String, default: "" },

    gallery: [String],

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      index: true,
      default: null,
    },

    serie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Serie",
      index: true,
      default: null,
    },

    // لیمیتد ادیشن (مثل Roland Garros) — وابسته به برند؛ محصول می‌تواند
    // هم‌زمان عضو یک سری و یک لیمیتد ادیشن باشد
    limitedEdition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LimitedEdition",
      index: true,
      default: null,
    },

    athlete: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Athlete",
      },
    ],

    // «دپارتمان» — فقط با قابلیت departments معنا دارد.
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      index: true,
      default: null,
    },

    attributes: {
      type: Object,
      default: {},
    },

    technicalStats: {
      type: Object,
      default: {},
    },

    // Values of store.config.js → catalog.product.customFields, by key.
    customFields: {
      type: Object,
      default: {},
    },

    // Units on hand for a product without variants (commerce.inventory.mode
    // "stock"); null = not tracked. Variants carry their own.
    stock: {
      type: Number,
      default: null,
      min: 0,
    },

    // Admin switch: a published product can still be "not for sale" (shown,
    // never added to a cart). Purchasability also needs the store's rules.
    purchasable: {
      type: Boolean,
      default: true,
    },

    customTabItems: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },

    // متادیتای سطحِ مقدارِ واریانت (Change 2/3): تصاویرِ مشترک هر مقدار و مقادیرِ چندواحدی.
    // شکل: { [attrName]: { [value]: { images: [String], units: { [unitLabel]: String } } } }
    // اختیاری و افزایشی؛ نبودنش = رفتارِ قبلی (تصاویر فقط در سطحِ واریانت).
    variantMeta: {
      type: Object,
      default: {},
    },

    slug: { type: String, unique: true, index: true },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ترتیب نمایش سراسری محصول — از صفحه‌ی «محصولات سری» در پنل ادمین
    // (درگ‌اند‌دراپ) تعیین می‌شود. محصولات جدید تا وقتی ادمین ترتیب را دستی
    // تغییر ندهد 0 می‌مانند و طبق createdAt (جدیدترین اول) مرتب می‌شوند.
    order: {
      type: Number,
      default: 0,
      index: true,
    },

    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],
  },
  { timestamps: true },
);

// ---------------------
// 🔥 Slug Generator
// ---------------------
ProductSchema.pre("validate", function () {
  if (!this.sku && this.name) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.sku = `${createSlug(this.name) || "item"}-${rand}`;
  }
});

// یکتا با پسوندِ -2، -3 … — دو محصولِ هم‌نام (رایج در هر فروشگاهی) نباید ذخیره را بشکنند
ProductSchema.pre("save", async function () {
  if (this.isModified("name") || this.isModified("modelName") || !this.slug) {
    const base = createSlug(this.name) || "product";
    let slug = base;
    let n = 2;
    const Model = this.constructor;
    while (await Model.exists({ slug, _id: { $ne: this._id } }).session(this.$session() || null)) {
      slug = `${base}-${n++}`;
    }
    this.slug = slug;
  }
});

// ---------------------
// 🔥 Virtual Comment
// ---------------------
ProductSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "product",
});

ProductSchema.index({ sport: 1, category: 1, brand: 1, isActive: 1 });
ProductSchema.index({ isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ targetAudience: 1, isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ sport: 1, isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ sport: 1, category: 1, isActive: 1, order: 1, createdAt: -1 });
ProductSchema.index({ category: 1, order: 1, createdAt: -1 });
// Mirrors the sport listing index so MongoDB can SORT_MERGE both branches of
// shared-sport queries without scanning the global active-products index.
ProductSchema.index({ category: 1, isActive: 1, order: 1, createdAt: -1 });

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
