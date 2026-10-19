// node --test tests/productRules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveProductRules,
  validateProductData,
  purchaseStatus,
  toPublicProduct,
  unknownCustomFieldKeys,
  coerceCustomFields,
  searchablePaths,
} from "../src/lib/productRules.js";

const config = {
  catalog: {
    product: {
      fields: {
        brand: { required: "published" },
        mainImage: { required: "published" },
        basePrice: { required: "purchasable", min: 0 },
        sku: { public: false, searchable: true },
        shortDescription: { maxLength: 10 },
      },
      customFields: [
        { key: "warranty", label: "گارانتی", type: "number", min: 0, max: 60, filterable: true },
        { key: "supplier", label: "تأمین‌کننده", type: "text", public: false, required: "published", searchable: true },
      ],
      categoryRules: {
        books: { fields: { brand: { use: false } }, customFields: [{ key: "isbn", label: "ISBN", type: "text", required: "draft" }] },
        gifts: { purchase: "inquiry" },
      },
    },
  },
  commerce: { purchase: { mode: "cart" }, inventory: { mode: "stock" } },
};

const rules = resolveProductRules([], config);

test("a draft needs only the name", () => {
  assert.equal(validateProductData({ name: "x" }, rules, { stage: "draft" }).error, undefined);
  assert.ok(validateProductData({ name: " " }, rules, { stage: "draft" }).fieldErrors.name);
});

test("publishing enforces published-stage fields, including internal custom ones", () => {
  const { fieldErrors } = validateProductData({ name: "x" }, rules, { stage: "published" });
  assert.ok(fieldErrors.brand);
  assert.ok(fieldErrors.mainImage);
  assert.ok(fieldErrors["customFields.supplier"]);
  assert.equal(fieldErrors.basePrice, undefined, "price is a purchasable-stage rule");
});

test("validation applies at every stage", () => {
  const { fieldErrors } = validateProductData(
    { name: "x", shortDescription: "far too long text", customFields: { warranty: 99 } },
    rules,
    { stage: "draft" },
  );
  assert.ok(fieldErrors.shortDescription);
  assert.ok(fieldErrors["customFields.warranty"]);
});

test("category rules: inherited, field turned off, extra custom field", () => {
  const books = resolveProductRules(["media", "books"], config);
  assert.equal(books.fields.brand.use, false);
  assert.ok(validateProductData({ name: "x" }, books, { stage: "draft" }).fieldErrors["customFields.isbn"]);
  assert.equal(resolveProductRules(["gifts", "cards"], config).purchase, "inquiry");
});

test("purchasability: price, publish state, stock, store mode", () => {
  const full = { name: "x", brand: "b", mainImage: "i", isActive: true, customFields: { supplier: "s" } };
  assert.deepEqual(purchaseStatus({ ...full, basePrice: 0 }, rules).purchasable, false);
  assert.equal(purchaseStatus({ ...full, basePrice: 10 }, rules).purchasable, true);
  assert.equal(purchaseStatus({ ...full, basePrice: 10, stock: 0 }, rules).purchasable, false);
  assert.equal(purchaseStatus({ ...full, basePrice: 0 }, rules, { variant: { price: 5, stock: 2 } }).purchasable, true);
  assert.equal(purchaseStatus({ ...full, basePrice: 0 }, rules, { variant: { price: 5, stock: 0 } }).purchasable, false);
  assert.equal(purchaseStatus({ ...full, basePrice: 10, isActive: false }, rules).purchasable, false);
  assert.equal(purchaseStatus({ ...full, basePrice: 10, purchasable: false }, rules).purchasable, false);
  const inquiry = resolveProductRules(["gifts"], config);
  assert.equal(purchaseStatus({ ...full, basePrice: 10 }, inquiry).mode, "inquiry");
  assert.equal(purchaseStatus({ ...full, basePrice: 10 }, inquiry).purchasable, false);
});

test("customers never see internal data", () => {
  const out = toPublicProduct(
    {
      name: "x",
      sku: "SKU-1",
      stock: 3,
      customFields: { warranty: 12, supplier: "secret" },
      attributes: { weight: 300, cost: 10 },
      category: { attributes: [{ name: "weight" }, { name: "cost", isPublic: false }] },
    },
    rules,
  );
  assert.equal(out.sku, "");
  assert.equal("stock" in out, false);
  assert.deepEqual(out.customFields, { warranty: 12 });
  assert.deepEqual(out.attributes, { weight: 300 });
  assert.deepEqual(out.category.attributes, [{ name: "weight" }]);
});

test("search and write helpers", () => {
  assert.ok(!searchablePaths(rules).includes("sku"), "an internal field is never searchable");
  assert.ok(!searchablePaths(rules).includes("customFields.supplier"));
  assert.deepEqual(unknownCustomFieldKeys({ warranty: 1, typo: 2 }, rules), ["typo"]);
  assert.deepEqual(coerceCustomFields({ warranty: "12", nope: 1 }, rules), { warranty: 12 });
});
