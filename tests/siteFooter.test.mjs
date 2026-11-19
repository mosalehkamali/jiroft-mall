// npm test -- siteFooter
import test from "node:test";
import assert from "node:assert/strict";
import { defaultSiteFooter, normalizeSiteFooter, renderCopyright, telHref, validateSiteFooter } from "../src/lib/siteFooter.js";

test("nothing stored → defaults from store.config; partial value keeps the rest", () => {
  assert.deepEqual(normalizeSiteFooter(null), defaultSiteFooter());
  const f = normalizeSiteFooter({ description: "x", socials: [{ key: "instagram", url: "https://i.com/a", enabled: true }] });
  assert.equal(f.description, "x");
  assert.equal(f.copyright, defaultSiteFooter().copyright);
  assert.equal(f.socials.find((s) => s.key === "instagram").enabled, true);
  assert.equal(f.socials.length, defaultSiteFooter().socials.length, "unknown platforms never appear");
});

test("validator trims, and refuses unsafe or incomplete values", () => {
  const ok = validateSiteFooter({ ...defaultSiteFooter(), phones: [" +98 912 000 0000 "], email: " a@b.co " });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.footer.phones, ["+98 912 000 0000"]);
  assert.equal(ok.footer.email, "a@b.co");

  const bad = (patch) => validateSiteFooter({ ...defaultSiteFooter(), ...patch }).errors.length > 0;
  assert.ok(bad({ sections: [{ title: "t", links: [{ label: "x", href: "javascript:alert(1)" }] }] }));
  assert.ok(bad({ sections: [{ title: "", links: [] }] }));
  assert.ok(bad({ socials: [{ key: "telegram", url: "", enabled: true }] }));
  assert.ok(bad({ socials: [{ key: "telegram", url: "tg://x", enabled: false }] }));
  assert.ok(bad({ phones: ["abc"] }));
  assert.ok(bad({ email: "nope" }));
  assert.ok(!bad({ sections: [{ title: "t", links: [{ label: "x", href: "/about" }, { label: "y", href: "https://a.com" }] }] }));
});

test("copyright year and tel: href", () => {
  assert.equal(renderCopyright("© {year} x", new Date("2026-05-01")), "© ۲۰۲۶ x");
  assert.equal(telHref("۰۲۱ ۱۲۳۴-۵۶۷۸"), "tel:02112345678");
  assert.equal(telHref("+98 (912) 000"), "tel:+98912000");
});
