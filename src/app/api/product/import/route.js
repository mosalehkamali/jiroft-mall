/**
 * POST /api/product/import — bulk product import.
 *
 * body: { products: [row, ...], dryRun?: boolean }
 *   row = the same payload POST /api/product/create takes. `category` and
 *   `brand` may be ids or slugs; `customFields` is an object by key.
 *
 * Every row goes through createProductFromPayload — the exact validation the
 * admin form gets (store rules, category attributes, variants). Rows are
 * independent: a bad row is reported and the others are still imported.
 * With dryRun nothing is written; the report says what would happen.
 */
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { createProductFromPayload, ProductInputError } from "base/services/productWrite.service";

const MAX_ROWS = 500;

export async function POST(req) {
  const { denied } = await requireAdminPermission("products.create");
  if (denied) return denied;

  try {
    const { products, dryRun = false } = await req.json();
    if (!Array.isArray(products) || products.length === 0) {
      return apiError("فهرست محصولات خالی است", 400);
    }
    if (products.length > MAX_ROWS) {
      return apiError(`حداکثر ${MAX_ROWS} محصول در هر بار`, 400);
    }

    const results = [];
    // sequential on purpose: two rows with the same name must not race for a SKU
    for (let index = 0; index < products.length; index++) {
      try {
        const product = await createProductFromPayload(products[index], { dryRun: Boolean(dryRun) });
        results.push({ index, ok: true, id: product?._id ? String(product._id) : null, name: product?.name });
      } catch (err) {
        if (!(err instanceof ProductInputError)) console.error("import row failed:", err);
        results.push({
          index,
          ok: false,
          error: err instanceof ProductInputError ? err.message : "خطای غیرمنتظره در ذخیره‌ی این ردیف",
          fieldErrors: err.fieldErrors || {},
        });
      }
    }

    const created = results.filter((r) => r.ok).length;
    if (created && !dryRun) revalidateContent(["products", "navbar"]);

    return Response.json({ dryRun: Boolean(dryRun), total: products.length, created, failed: products.length - created, results });
  } catch (err) {
    return handleApiError(err, "خطا در ورود گروهی محصولات");
  }
}
