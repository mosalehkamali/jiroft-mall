// node --test tests/features.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FEATURES, __test, disabledFeatureForPath, isFeatureEnabled, isHrefEnabled, isPermissionKeyEnabled } from "../src/lib/features.js";
import { computeEffectivePermissions, getAllPermissionKeys, PERMISSION_MODULES } from "../src/lib/permissions.js";
import storeConfig from "../store.config.js";

const { resolveFlags, matches } = __test;

test("a feature is on only when it and every dependency are on", () => {
  const on = resolveFlags({ features: { reviewCredit: true, wallet: true, reviews: true } });
  assert.ok(on.has("reviewCredit"));
  assert.ok(!resolveFlags({ features: { reviewCredit: true, wallet: true, reviews: false } }).has("reviewCredit"));
  assert.ok(!resolveFlags({ features: { athletes: true } }).has("athletes"), "athletes needs departments");
  assert.ok(!resolveFlags({ features: { reviewCredit: true, reviews: true } }).has("reviewCredit"), "needs wallet too");
});

test("exchangeRate follows the pricing mode, not a switch", () => {
  assert.ok(resolveFlags({ features: {}, commerce: { pricing: { mode: "exchange" } } }).has("exchangeRate"));
  assert.ok(!resolveFlags({ features: { exchangeRate: true }, commerce: { pricing: { mode: "direct" } } }).has("exchangeRate"));
});

test("dependency graph has no unknown keys", () => {
  for (const [key, def] of Object.entries(FEATURES)) {
    for (const dep of def.requires || []) assert.ok(FEATURES[dep], `${key} requires unknown ${dep}`);
  }
  for (const key of Object.keys(storeConfig.features)) assert.ok(FEATURES[key], `store.config feature "${key}" is not registered`);
});

test("every module a feature claims exists in the permission registry", () => {
  const modules = new Set(PERMISSION_MODULES.map((m) => m.key));
  for (const [key, def] of Object.entries(FEATURES)) {
    for (const m of def.modules || []) assert.ok(modules.has(m), `${key}: unknown module ${m}`);
  }
});

test("path patterns: prefix match, * is one segment", () => {
  assert.ok(matches("/api/admin/orders/*/eur", "/api/admin/orders/abc/eur/item"));
  assert.ok(!matches("/api/admin/orders/*/eur", "/api/admin/orders/abc"));
  assert.ok(matches("/content", "/content/a/b"));
  assert.ok(!matches("/content", "/contents"));
});

test("the default store: sports-specific features are off and closed everywhere", () => {
  assert.equal(isFeatureEnabled("departments"), false);
  assert.equal(disabledFeatureForPath("/athletes"), "athletes");
  assert.equal(disabledFeatureForPath("/api/sports"), "departments");
  assert.equal(disabledFeatureForPath("/match/tennis/racket"), "racketFinder");
  assert.equal(disabledFeatureForPath("/products"), null);
  assert.equal(isHrefEnabled("/second-hand"), false);
  assert.equal(isHrefEnabled("https://example.com"), true);
});

test("full access never includes a disabled feature's keys, but the keys stay valid", () => {
  const full = computeEffectivePermissions({ fullAccess: true });
  assert.ok(!full.includes("sports.view"));
  assert.ok(!full.includes("orders.setCurrency"));
  assert.ok(full.includes("orders.view"));
  assert.ok(getAllPermissionKeys().includes("sports.view"), "stored keys are not invalidated");
  const role = computeEffectivePermissions({ rolePermissions: ["sports.view", "products.view"] });
  assert.deepEqual(role, ["products.view"]);
  assert.equal(isPermissionKeyEnabled("products.edit"), true);
});

test("AI product tools need departments; their pages and APIs close with the feature", async () => {
  assert.ok(!resolveFlags({ features: { aiProductDraft: true } }).has("aiProductDraft"), "needs departments");
  assert.ok(resolveFlags({ features: { aiProductDraft: true, departments: true } }).has("aiProductDraft"));
  // the shipped config has aiProductDraft off
  for (const path of ["/api/admin/product-prompts/preview", "/api/product/abc/regenerate/generate",
    "/p-admin/admin-products/prompt-settings/base", "/p-admin/admin-products/abc/regenerate"]) {
    assert.equal(disabledFeatureForPath(path), "aiProductDraft", path);
  }
  assert.equal(disabledFeatureForPath("/api/product/abc"), null, "the product API itself stays");
  assert.ok(!isPermissionKeyEnabled("productPrompts.view"));
});

test("article blocks follow their feature (shipped config)", async () => {
  const { isBlockTypeEnabled } = await import("../src/lib/articleBlockTypes.js");
  assert.equal(isBlockTypeEnabled("brandBar"), isFeatureEnabled("brands"));
  assert.equal(isBlockTypeEnabled("sportSeriesSlider"), isFeatureEnabled("series") && isFeatureEnabled("departments"));
  assert.equal(isBlockTypeEnabled("reviewSlider"), isFeatureEnabled("reviews"));
  assert.equal(isBlockTypeEnabled("matchBanner"), isFeatureEnabled("racketFinder"));
  assert.ok(isBlockTypeEnabled("paragraph"), "ungated blocks are always on");
});
