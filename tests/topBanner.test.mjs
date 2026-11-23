import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TOP_BANNER, validateTopBanner } from "../src/lib/topBanner.js";
import { resolveSiteSettingPermission } from "../src/lib/apiPermissions.js";

const banner = { enabled: true, image: "https://images.example/banner.gif", href: "/محصولات" };

test("top banner accepts animated media, internal routes and HTTPS destinations", () => {
  for (const value of [EMPTY_TOP_BANNER, banner, { ...banner, href: "https://example.com/sale" }, { ...banner, enabled: false }])
    assert.equal(validateTopBanner(value), "");
});

test("an active banner needs an image and a safe destination", () => {
  for (const value of [null, { ...banner, image: "" }, { ...banner, href: "" }, { ...banner, href: "//example.com" },
    { ...banner, image: "data:image/png;base64,AAAA" }, { ...banner, href: "javascript:void(0)" }, { ...banner, enabled: "true" }])
    assert.ok(validateTopBanner(value));
});

test("top banner settings use the existing banner view and edit permissions", () => {
  for (const action of ["view", "edit"])
    assert.deepEqual(resolveSiteSettingPermission("store_top_banner", action).permissions, ["homeBanners." + action]);
});
