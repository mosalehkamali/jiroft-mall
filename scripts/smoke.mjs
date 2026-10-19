/**
 * scripts/smoke.mjs — end-to-end check of a running store against its own
 * store.config.js: product rules, import, purchasability, checkout, feature
 * gating. Writes test data, so point it at a dev/staging database only.
 *
 *   npm run dev:db && npm run seed -- --phone 09120000000 --password Secret123
 *   npm run build && npm start
 *   npm run smoke -- --phone 09120000000 --password Secret123 [--base http://localhost:3000]
 */
import assert from "node:assert/strict";
import storeConfig from "../store.config.js";
import { isFeatureEnabled } from "../src/lib/features.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("base", "http://localhost:3000");
const PHONE = arg("phone");
const PASSWORD = arg("password");
if (!PHONE || !PASSWORD) {
  console.error("usage: npm run smoke -- --phone <admin phone> --password <admin password> [--base url]");
  process.exit(1);
}

const tag = Date.now().toString(36);
let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${err.message.split("\n").join("\n      ")}`);
  }
}

function session() {
  let cookie = "";
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text };
  };
}

const admin = session();
const customer = session();
const rules = (await import("../src/lib/productRules.js")).resolveProductRules([]);

console.log(`\nSmoke test against ${BASE} (${storeConfig.brand.name})\n`);

await check("admin login", async () => {
  const r = await admin("POST", "/api/auth/login", { phone: PHONE, password: PASSWORD });
  assert.equal(r.status, 200, r.text);
});

let categoryId = null;
await check("a category exists (or is created)", async () => {
  const list = await admin("GET", "/api/categories");
  categoryId = list.json?.categories?.[0]?._id;
  if (!categoryId) {
    const r = await admin("POST", "/api/categories/create", { title: `دسته ${tag}`, name: `smoke ${tag}`, attributes: [], variantAttributes: [] });
    assert.ok([200, 201].includes(r.status), r.text);
    categoryId = r.json?.category?._id;
  }
  assert.ok(categoryId);
});

await check("draft: only the name is required", async () => {
  const r = await admin("POST", "/api/product/create", { name: `پیش‌نویس ${tag}`, isActive: false });
  assert.equal(r.status, 201, r.text);
});

await check("publishing enforces the published-stage rules", async () => {
  const r = await admin("POST", "/api/product/create", { name: `ناقص ${tag}`, isActive: true });
  const required = Object.values(rules.fields).filter((f) => f.required === "published" || f.required === "draft").map((f) => f.key).filter((k) => k !== "name");
  if (!required.length) return; // this store requires nothing beyond the name
  assert.equal(r.status, 400, r.text);
  for (const key of required) assert.ok(r.json.fieldErrors?.[key], `missing fieldErrors.${key}: ${r.text}`);
});

await check("duplicate product names get distinct slugs", async () => {
  const a = await admin("POST", "/api/product/create", { name: `هم‌نام ${tag}`, isActive: false });
  const b = await admin("POST", "/api/product/create", { name: `هم‌نام ${tag}`, isActive: false });
  assert.equal(a.status, 201, a.text);
  assert.equal(b.status, 201, b.text);
  assert.notEqual(a.json.product.slug, b.json.product.slug);
});

await check("an unknown custom field is rejected, not silently stored", async () => {
  const r = await admin("POST", "/api/product/create", { name: `x ${tag}`, isActive: false, customFields: { __nope: 1 } });
  assert.equal(r.status, 400, r.text);
});

const full = { category: categoryId, mainImage: storeConfig.brand.imageFallback, isActive: true };
let noPrice = null;
let priced = null;
await check("published without a price: saved, shown, not purchasable", async () => {
  const r = await admin("POST", "/api/product/create", { ...full, name: `بدون قیمت ${tag}` });
  assert.equal(r.status, 201, r.text);
  noPrice = r.json.product;
  const cart = await customer("POST", "/api/cart/price", { items: [{ productId: noPrice._id, quantity: 1 }] });
  assert.equal(cart.status, 200, cart.text);
  assert.equal(cart.json.unavailable?.length, 1, cart.text);
});

await check("a complete product is purchasable", async () => {
  const r = await admin("POST", "/api/product/create", { ...full, name: `کامل ${tag}`, basePrice: 250000 });
  assert.equal(r.status, 201, r.text);
  priced = r.json.product;
  const cart = await customer("POST", "/api/cart/price", { items: [{ productId: priced._id, quantity: 2 }] });
  assert.equal(cart.status, 200, cart.text);
  assert.equal(cart.json.unavailable.length, 0, cart.text);
  assert.ok(cart.json.finalTotalToman > 0, cart.text);
});

await check("edit: publishing a draft is held to the same rules", async () => {
  const d = await admin("POST", "/api/product/create", { name: `ویرایش ${tag}`, isActive: false });
  const id = d.json.product._id;
  const bad = await admin("PUT", `/api/product/${id}`, { isActive: true, mainImage: "" });
  if (rules.fields.mainImage.required === "published") assert.equal(bad.status, 400, bad.text);
  const ok = await admin("PUT", `/api/product/${id}`, { isActive: true, ...full });
  assert.equal(ok.status, 200, ok.text);
});

await check("import: dry run reports per row, writes nothing", async () => {
  const rows = [
    { name: `ورود ۱ ${tag}`, isActive: false },
    { name: "", isActive: false },
    { name: `ورود ۲ ${tag}`, ...full, basePrice: 1000 },
  ];
  const r = await admin("POST", "/api/product/import", { products: rows, dryRun: true });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.results.map((x) => x.ok), [true, false, true]);
  const real = await admin("POST", "/api/product/import", { products: rows });
  assert.equal(real.json.created, 2, real.text);
});

await check("public product APIs never expose internal fields", async () => {
  const r = await customer("GET", `/api/product/${priced._id}`);
  assert.equal(r.status, 200, r.text);
  if (!rules.fields.sku.public) assert.ok(!r.json.product.sku, "sku leaked");
});

await check("checkout: an unpurchasable line is refused", async () => {
  const phone = `0912${String(Date.now()).slice(-7)}`;
  const reg = await customer("POST", "/api/auth/register", { phone, password: "Customer123", name: "مشتری", lastName: "تست" });
  assert.ok([200, 201].includes(reg.status), reg.text);
  const r = await customer("POST", "/api/checkout", {
    items: [{ productId: noPrice._id, quantity: 1, itemType: "product" }],
    addressSnapshot: { fullName: "مشتری تست", phone, province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان نمونه پلاک ۱" },
    paymentMethod: "BANK_RECEIPT",
    receiptImageUrls: [`${BASE}${storeConfig.brand.imageFallback}`],
  });
  assert.equal(r.status, 409, r.text);
});

await check("checkout: a purchasable cart becomes an order", async () => {
  const r = await customer("POST", "/api/checkout", {
    items: [{ productId: priced._id, quantity: 1, itemType: "product" }],
    addressSnapshot: { fullName: "مشتری تست", phone: "09121234567", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان نمونه پلاک ۱" },
    paymentMethod: (storeConfig.commerce.paymentMethods || ["BANK_RECEIPT"])[0],
    receiptImageUrls: [`${BASE}${storeConfig.brand.imageFallback}`],
  });
  assert.equal(r.status, 201, r.text);
  assert.ok(r.json.trackingCode);
});

await check("disabled features are closed: pages, APIs and admin permissions", async () => {
  const { FEATURES } = await import("../src/lib/features.js");
  const off = Object.entries(FEATURES).filter(([key, def]) => !isFeatureEnabled(key) && def.paths?.length);
  for (const [key, def] of off) {
    const path = def.paths[0].replace(/\*/g, "x");
    const r = await customer("GET", path);
    assert.equal(r.status, 404, `${key}: ${path} → ${r.status}`);
  }
  const perms = await admin("GET", "/api/admin/permissions");
  assert.equal(perms.status, 200, perms.text);
  const modules = new Set(perms.json.modules.map((m) => m.key));
  for (const [key, def] of Object.entries(FEATURES)) {
    if (isFeatureEnabled(key)) continue;
    for (const m of def.modules || []) assert.ok(!modules.has(m), `${key}: module ${m} still offered`);
  }
});

console.log(failures ? `\n${failures} check(s) failed\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
