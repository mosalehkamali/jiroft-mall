import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { createProductFromPayload, ProductInputError } from "base/services/productWrite.service";

/* ----------------------------------
   POST: Create Product
   The validation and write live in services/productWrite.service.js, shared
   with the bulk import so both accept exactly the same products.
---------------------------------- */
export async function POST(req) {
  const { denied } = await requireAdminPermission("products.create");
  if (denied) return denied;

  try {
    const body = await req.json();
    const product = await createProductFromPayload(body);

    // باطل‌سازی کش محتوا تا محصول جدید بلافاصله در صفحات نمایش داده شود
    revalidateContent(["products", "navbar"]);

    return Response.json(
      { message: "Product and variants created successfully", product },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ProductInputError) {
      return apiError(err.message, err.status, { fieldErrors: err.fieldErrors });
    }
    return handleApiError(err, "خطا در ایجاد محصول");
  }
}
