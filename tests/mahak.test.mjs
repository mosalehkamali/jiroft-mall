// node --test --test-timeout=180000 tests/mahak.test.mjs
//
// The Mahak integration end to end against a real replica set and the real
// schemas, with the Mahak HTTP API replaced by an in-memory fake that follows
// the published spec (LoginV2 / GetAllDataV2 by rowVersion / SaveAllDataV2).
// Runs against the shipped store.config.js (two accounts: shoes, clothing).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { allocate, buildInvoicePayload, mahakStock, parseProperties, planProduct, saveErrors } from "../src/lib/mahak/mapping.js";

register("./aliasHooks.mjs", import.meta.url);

/* ── a fake Mahak ─────────────────────────────────────────────────────── */
const VISITOR = { shoes: 11, clothing: 22 };
const db = { shoes: {}, clothing: {} };
const saved = []; // every SaveAllData body, with its account
let version = 0;
let failSaves = false;
const PAGE = 2; // tiny pages: the client must keep asking

const ID_FIELD = {
  products: "productId",
  productDetails: "productDetailId",
  productCategories: "productCategoryId",
  visitorProducts: "visitorProductId",
  productDetailStoreAssets: "productDetailStoreAssetId",
};
const FROM = {
  fromProductVersion: "products",
  fromProductDetailVersion: "productDetails",
  fromProductCategoryVersion: "productCategories",
  fromVisitorProductVersion: "visitorProducts",
  fromProductDetailStoreAssetVersion: "productDetailStoreAssets",
};

function put(account, entity, row) {
  const idField = ID_FIELD[entity];
  const list = (db[account][entity] ||= []);
  const i = list.findIndex((r) => r[idField] === row[idField]);
  const next = { deleted: false, ...(i >= 0 ? list[i] : {}), ...row, rowVersion: ++version };
  if (i >= 0) list[i] = next;
  else list.push(next);
}

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const reply = (data, result = true, message = "") =>
    new Response(JSON.stringify({ result, code: 0, message, data }), { status: 200 });
  if (url.endsWith("/Sync/LoginV2")) {
    const account = body.userName.replace("user-", "");
    if (!VISITOR[account] || body.password !== "secret") return reply(null, false, "نام کاربری یا رمز اشتباه است");
    return reply({ userToken: `tok-${account}`, visitorId: VISITOR[account], databaseId: body.databaseId });
  }
  const account = String(init.headers.Authorization || "").replace("Bearer tok-", "");
  if (!VISITOR[account]) return new Response("", { status: 401 });
  if (url.endsWith("/Sync/GetAllDataV2")) {
    assert.equal(body.currentVisitorId, VISITOR[account]);
    const objects = {};
    for (const [field, entity] of Object.entries(FROM)) {
      if (body[field] == null) continue; // "do not send a RowVersion for what you do not need"
      objects[entity] = (db[account][entity] || [])
        .filter((r) => r.rowVersion > body[field])
        .sort((a, b) => a.rowVersion - b.rowVersion)
        .slice(0, PAGE);
    }
    return reply({ objects });
  }
  if (url.endsWith("/Sync/SaveAllDataV2")) {
    if (failSaves) return reply(null, false, "سرور محک در دسترس نیست");
    saved.push({ account, body });
    const ok = (rows) => ({
      results: rows.map((r, index) => ({ result: true, index, entityId: 9000 + saved.length, errors: [] })),
    });
    return reply({ objects: { people: ok(body.people), orders: ok(body.orders), orderDetails: ok(body.orderDetails) } });
  }
  return new Response("", { status: 404 });
};

for (const key of ["SHOES", "CLOTHING"]) {
  process.env[`MAHAK_${key}_USERNAME`] = `user-${key.toLowerCase()}`;
  process.env[`MAHAK_${key}_PASSWORD`] = "secret";
  process.env[`MAHAK_${key}_DATABASE_ID`] = "77";
}

/* ── pure ─────────────────────────────────────────────────────────────── */
test("properties: JSON array, JSON map, plain text, junk", () => {
  assert.deepEqual(parseProperties('[{"Name":"سایز","Value":"42"},{"name":"رنگ","value":" مشکی "}]'), [
    { name: "سایز", value: "42" },
    { name: "رنگ", value: "مشکی" },
  ]);
  assert.deepEqual(parseProperties('{"سایز":"L"}'), [{ name: "سایز", value: "L" }]);
  assert.deepEqual(parseProperties("قرمز"), [{ name: "مدل", value: "قرمز" }]);
  assert.deepEqual(parseProperties(""), []);
  assert.deepEqual(parseProperties("[1,2]"), []);
});

test("plan: one plain detail is a product without variants; several are variants", () => {
  const product = { productId: 1, name: " کتانی " };
  const single = planProduct(product, [{ productDetailId: 5, productId: 1, price1: 1000, defaultSellPriceLevel: 1 }]);
  assert.equal(single.hasVariants, false);
  assert.equal(single.name, "کتانی");
  assert.equal(single.lines[0].price, 1000);

  // unreadable properties: still one variant per detail, each with its own name
  const many = planProduct(product, [
    { productDetailId: 5, productId: 1, price1: 1, barcode: "A" },
    { productDetailId: 6, productId: 1, price1: 1, barcode: "A" },
  ]);
  assert.equal(many.hasVariants, true);
  assert.equal(new Set(many.lines.map((l) => l.attributes["مدل"])).size, 2);

  // price level + divisor (Rial → Toman); an unassigned or deleted detail is not sold
  const plan = planProduct(
    product,
    [
      { productDetailId: 5, productId: 1, price1: 10, price2: 50000, defaultSellPriceLevel: 2 },
      { productDetailId: 6, productId: 1, price1: 10, deleted: true },
      { productDetailId: 7, productId: 1, price1: 10 },
    ],
    { assigned: (id) => id !== 7, divisor: 10 },
  );
  assert.deepEqual(plan.lines.map((l) => [l.productDetailId, l.price]), [[5, 5000]]);
  assert.equal(planProduct({ ...product, deleted: true }, [{ productDetailId: 5 }]), null);
});

test("stock source and discount split", () => {
  const assets = [
    { storeId: 1, count1: 3 },
    { storeId: 2, count1: 4.9 },
    { storeId: 3, count1: 9, deleted: true },
  ];
  const visitorProduct = { count1: 2 };
  assert.equal(mahakStock({ visitorProduct, assets, accountHasAssets: true }), 7);
  assert.equal(mahakStock({ visitorProduct, assets, accountHasAssets: true, storeIds: [1] }), 3);
  assert.equal(mahakStock({ visitorProduct, assets: [], accountHasAssets: false }), 2);
  assert.equal(mahakStock({ visitorProduct, assets, source: "visitorProducts", accountHasAssets: true }), 2);
  assert.deepEqual(allocate(100, [1, 1, 1]), [33, 33, 34]);
  assert.deepEqual(allocate(0, [5, 5]), [0, 0]);
});

test("invoice payload follows the spec's client-id rules", () => {
  const body = buildInvoicePayload({
    order: { trackingCode: "T1", orderDate: "2026-01-01", address: { snapshot: { fullName: "علی", city: "جیرفت" } } },
    lines: [{ productDetailId: 101, quantity: 2, unitPrice: 500 }],
    ids: { orderClientId: 77, personClientId: 9120000000, visitorId: 11 },
    person: { firstName: "علی", lastName: "", mobile: "09120000000" },
    discount: 30,
    multiplier: 10,
  });
  assert.equal(body.orders[0].visitorId, 11);
  assert.equal(body.orders[0].orderType, 201);
  assert.equal(body.orders[0].discount, 300);
  assert.equal(body.orderDetails[0].orderClientId, 77);
  assert.equal(body.orderDetails[0].price, 5000);
  assert.equal(body.orderDetails[0].count1, 2);
  assert.equal(body.people[0].personClientId, body.orders[0].personClientId);
  assert.equal(
    saveErrors({
      people: { results: [{ result: true }] },
      orders: { results: [{ result: false, index: 0, errors: [{ property: "visitorId", error: "نامعتبر" }] }] },
    }),
    "orders[0]: visitorId: نامعتبر | orderDetails: پاسخی از محک نیامد",
  );
});

/* ── end to end ───────────────────────────────────────────────────────── */
let repl, Product, Variant, Order, Mahak, sync, orders;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import("../models/registerModels.js");
  Product = mongoose.model("Product");
  Variant = mongoose.model("Variant");
  Order = mongoose.model("Order");
  Mahak = await import("../models/Mahak.js");
  await Promise.all([Product.init(), Variant.init(), Mahak.MahakRow.init(), Mahak.MahakLink.init(), Mahak.MahakAccount.init()]);
  sync = await import("../services/mahak/sync.service.js");
  orders = await import("../services/mahak/order.service.js");

  // shoes: one model in two sizes. clothing: one plain item — with the SAME Mahak ids on purpose.
  put("shoes", "productCategories", { productCategoryId: 7, name: "کفش مردانه" });
  put("shoes", "products", { productId: 1, name: "کتانی سفید", productCategoryId: 7 });
  put("shoes", "productDetails", { productDetailId: 101, productId: 1, price1: 5000000, defaultSellPriceLevel: 1, properties: '[{"Name":"سایز","Value":"42"}]' });
  put("shoes", "productDetails", { productDetailId: 102, productId: 1, price1: 5200000, defaultSellPriceLevel: 1, properties: '[{"Name":"سایز","Value":"43"}]' });
  put("shoes", "visitorProducts", { visitorProductId: 1, productDetailId: 101, visitorId: 11, count1: 0 });
  put("shoes", "visitorProducts", { visitorProductId: 2, productDetailId: 102, visitorId: 11, count1: 0 });
  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 1, productDetailId: 101, storeId: 1, count1: 3 });
  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 2, productDetailId: 102, storeId: 1, count1: 0 });
  put("clothing", "products", { productId: 1, name: "تیشرت ساده", productCategoryId: 0 });
  put("clothing", "productDetails", { productDetailId: 101, productId: 1, price1: 800000, defaultSellPriceLevel: 1, barcode: "626" });
  put("clothing", "visitorProducts", { visitorProductId: 1, productDetailId: 101, visitorId: 22, count1: 5 });
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

const shoe = () => Product.findOne({ sku: "MHK-shoes-1" }).lean();
const shirt = () => Product.findOne({ sku: "MHK-clothing-1" }).lean();
const size = async (value) =>
  (await Variant.find({ sku: /^MHK-shoes-1-/ })).find((v) => v.attributes.get("سایز") === value);

test("first sync: both accounts become site products, hidden until they have an image", async () => {
  const result = await sync.runMahakSync();
  assert.equal(result.enabled, true);
  assert.deepEqual(result.accounts.map((a) => a.error), [undefined, undefined]);
  assert.deepEqual(result.accounts.map((a) => a.errors), [[], []]);
  assert.equal(await Product.countDocuments(), 2);

  const s = await shoe();
  assert.equal(s.name, "کتانی سفید");
  assert.equal(s.basePrice, 5000000);
  assert.equal(s.stock, null, "a product with variants keeps stock on its variants");
  assert.equal(s.isActive, false, "in stock but no image → not shown");
  assert.equal(s.variants.length, 2);
  assert.equal((await size("42")).stock, 3);
  assert.equal((await size("43")).price, 5200000);
  const category = await mongoose.model("Category").findById(s.category).lean();
  assert.equal(category.title, "کفش مردانه");
  assert.deepEqual(category.variantAttributes.map((a) => a.name), ["سایز"]);

  const t = await shirt();
  assert.equal(t.stock, 5, "no warehouse rows for this account → the assigned count");
  assert.equal(t.variants.length, 0);
  assert.equal((await mongoose.model("Category").findById(t.category).lean()).title, "پوشاک");
  assert.equal(await Mahak.MahakLink.countDocuments(), 3, "same Mahak ids in two accounts stay separate");
});

test("a second sync with nothing new changes nothing and creates nothing", async () => {
  const ids = (await Variant.find().lean()).map((v) => String(v._id)).sort();
  const result = await sync.runMahakSync();
  assert.equal(result.changed, false);
  assert.deepEqual(result.accounts.map((a) => a.built), [0, 0]);
  assert.deepEqual((await Variant.find().lean()).map((v) => String(v._id)).sort(), ids);
});

test("image + stock = visible; sold out in Mahak = hidden again", async () => {
  for (const p of [await shoe(), await shirt()]) {
    await Product.updateOne(
      { _id: p._id },
      { $set: { mainImage: "https://ik.imagekit.io/x/a.jpg", stock: p.stock == null ? null : 99 } },
    );
    await sync.afterMahakProductEdit(p._id);
  }
  assert.equal((await shoe()).isActive, true);
  assert.equal((await shirt()).isActive, true);
  assert.equal((await shirt()).stock, 5, "a stock typed into the admin form is replaced by Mahak's");

  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 1, count1: 0 });
  assert.equal((await sync.runMahakSync()).changed, true);
  assert.equal((await shoe()).isActive, false, "has an image but nothing in stock");

  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 1, count1: 2 });
  put("shoes", "products", { productId: 1, name: "کتانی سفید مدل جدید" });
  await sync.runMahakSync();
  const s = await shoe();
  assert.equal(s.isActive, true);
  assert.equal(s.name, "کتانی سفید مدل جدید");
  assert.equal(s.slug, "کتانی-سفید", "renaming in Mahak never moves the product's URL");
});

test("a detail removed in Mahak is sold out, its variant (and _id) is kept", async () => {
  const before43 = await size("43");
  put("shoes", "productDetails", { productDetailId: 102, deleted: true });
  await sync.runMahakSync();
  const after43 = await Variant.findById(before43._id);
  assert.ok(after43, "variants are never deleted: orders reference their _id");
  assert.equal(after43.stock, 0);
  assert.equal((await Mahak.MahakLink.findOne({ account: "shoes", productDetailId: 102 })).gone, true);
});

test("before payment: fresh stock is pulled and shortages are named", async () => {
  const v42 = await size("42");
  const t = await shirt();
  assert.deepEqual(
    await sync.checkMahakStock([
      { productId: v42.productId, variantId: v42._id, quantity: 2 },
      { productId: t._id, quantity: 5 },
    ]),
    [],
  );

  // someone buys in the shop: Mahak now has 1 — the site has not synced yet
  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 1, count1: 1 });
  await Mahak.MahakAccount.updateMany({}, { $set: { lastStockSyncAt: null } });
  const short = await sync.checkMahakStock([{ productId: v42.productId, variantId: v42._id, quantity: 2 }]);
  assert.equal(short.length, 1);
  assert.equal(short[0].available, 1);
  assert.equal(short[0].requested, 2);
  assert.match(sync.shortageMessage(short), /فقط 1 عدد موجود است/);
  put("shoes", "productDetailStoreAssets", { productDetailStoreAssetId: 1, count1: 2 });
});

test("an order of both accounts → one invoice per account, held stock, no duplicates", async () => {
  await Mahak.MahakAccount.updateMany({}, { $set: { lastStockSyncAt: null } });
  const v42 = await size("42");
  const t = await shirt();
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [
      { product: v42.productId, variant: v42._id, quantity: 2, unitPrice: 5000000 },
      { product: t._id, quantity: 1, unitPrice: 800000 },
    ],
    subtotalPrice: 10800000,
    couponDiscount: 108000,
    totalPrice: 10692000,
    paymentMethod: "BANK_RECEIPT",
    inventoryReserved: true,
    address: { snapshot: { fullName: "مریم احمدی", phone: "09131234567", city: "جیرفت", addressLine: "خیابان اصلی" } },
  });

  // the site promised 2 of the 2 pairs Mahak still counts → nothing left to sell
  await sync.runMahakSync();
  assert.equal((await size("42")).stock, 0);
  assert.equal((await shirt()).stock, 4);

  saved.length = 0;
  assert.equal((await orders.postOrderInvoices(order._id)).state, "done");
  assert.deepEqual(saved.map((s) => s.account).sort(), ["clothing", "shoes"]);
  const byAccount = Object.fromEntries(saved.map((s) => [s.account, s.body]));
  assert.equal(byAccount.shoes.orders[0].visitorId, 11);
  assert.equal(byAccount.clothing.orders[0].visitorId, 22);
  assert.equal(byAccount.shoes.orderDetails[0].productDetailId, 101);
  assert.equal(byAccount.shoes.orderDetails[0].count1, 2);
  assert.equal(byAccount.shoes.orderDetails[0].price, 5000000);
  assert.equal(byAccount.shoes.orders[0].discount + byAccount.clothing.orders[0].discount, 108000);
  assert.equal(byAccount.shoes.people[0].personClientId, 9131234567);
  assert.match(byAccount.shoes.orders[0].description, new RegExp(order.trackingCode));

  const stored = await Order.findById(order._id).select("+mahak").lean();
  assert.equal(stored.mahak.state, "done");
  assert.equal(stored.mahak.invoices.every((i) => i.postedAt && i.orderId), true);
  assert.equal((await Order.findById(order._id).lean()).mahak, undefined, "never selected by default");

  await orders.postOrderInvoices(order._id);
  assert.equal(saved.length, 2, "a finished order is never posted twice");
});

test("a failed invoice is retried with the same number", async () => {
  const t = await shirt();
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(),
    items: [{ product: t._id, quantity: 1, unitPrice: 800000 }],
    subtotalPrice: 800000,
    totalPrice: 800000,
    paymentMethod: "BANK_RECEIPT",
  });
  failSaves = true;
  saved.length = 0;
  await orders.queueMahakInvoice(order._id); // must not throw
  const failed = await Order.findById(order._id).select("+mahak").lean();
  assert.equal(failed.mahak.state, "failed");
  assert.match(failed.mahak.error, /در دسترس نیست/);
  const number = failed.mahak.invoices[0].orderClientId;
  assert.ok(number > 0);

  failSaves = false;
  assert.deepEqual(await orders.retryMahakInvoices(), { retried: 1, done: 1 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].body.orders[0].orderClientId, number);
  const numbers = (await Order.find().select("+mahak").lean()).flatMap((o) =>
    o.mahak.invoices.filter((i) => i.account === "clothing").map((i) => i.orderClientId),
  );
  assert.equal(new Set(numbers).size, numbers.length, "invoice numbers are unique per account");
});

test("an account without credentials is skipped, not an error", async () => {
  const kept = process.env.MAHAK_CLOTHING_USERNAME;
  delete process.env.MAHAK_CLOTHING_USERNAME;
  const result = await sync.runMahakSync();
  process.env.MAHAK_CLOTHING_USERNAME = kept;
  assert.equal(result.accounts.find((a) => a.key === "clothing").skipped, "not-configured");
  assert.equal(result.accounts.find((a) => a.key === "shoes").error, undefined);
});
