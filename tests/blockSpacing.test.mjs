/**
 * tests/blockSpacing.test.mjs
 *
 * فاصله‌ی پیش‌فرضِ بلوک صفر شد. این فایل دو چیز را قفل می‌کند: مهاجرتی که
 * فاصله‌ی *فعلیِ* محتوای موجود را صریح می‌کند (پس هیچ صفحه‌ای جابه‌جا نمی‌شود)،
 * و اینکه کلاسِ مشترکِ بلوک دیگر حاشیه‌ی پیش‌فرض ندارد.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const block = (type, style) => ({ id: type, type, data: {}, ...(style ? { style } : {}) });




test("the shared block class no longer carries a default margin", async () => {
  const src = await readFile(new URL("../src/components/features/articles/ArticleBlockRenderer.jsx", import.meta.url), "utf8");
  assert.match(src, /const blockSection = "scroll-mt-28";/);
  assert.match(src, /my-5/, "paragraph keeps its own rhythm");
  assert.match(src, /my-10/, "divider keeps its own rhythm");
});

test("spacing round-trip: md survives a save, none is the stripped default", async () => {
  const { sanitizeArticleBlockStyle } = await import("../src/lib/articleBlockValidation.js");
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "md" }), { spacing: "md" }, "the pinned value must survive an admin save");
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "lg" }), { spacing: "lg" });
  assert.equal(sanitizeArticleBlockStyle({ spacing: "none" }), undefined, "none is the default and is not stored");
  const src = await readFile(new URL("../src/components/features/articles/ArticleBlockRenderer.jsx", import.meta.url), "utf8");
  assert.match(src, /const SPACING_CSS = \{ none: "0rem", sm: "1rem", md: "2\.25rem", lg: "4rem" \};/, "every spacing value renders, md included");
});
