import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import { checkMahakStock, shortageMessage } from "base/services/mahak/sync.service";
import { revalidateContent } from "@/lib/revalidate";
import { expireUnpaidOnlineOrders } from "base/services/onlinePayment.service";

/**
 * POST /api/checkout/stock-check { items } — asked when the customer opens the
 * payment step, i.e. BEFORE any money moves (card transfer or gateway).
 * Fresh stock is pulled from Mahak for the items in the cart.
 *   200 { ok: true }
 *   409 { ok: false, message, outOfStock: [{ productId, variantId, name, requested, available }] }
 * POST /api/checkout repeats the same check when the order is created.
 */
export async function POST(req) {
  const token = (await cookies()).get("accessToken")?.value;
  if (!token || !verifyToken(token)) return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
  const { items } = await req.json().catch(() => ({}));
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    return NextResponse.json({ message: "سبد خرید خالی است" }, { status: 400 });
  }
  await connectToDB();
  await expireUnpaidOnlineOrders().catch((e) => console.error("[stock-check] expire:", e?.message));
  const outOfStock = await checkMahakStock(items);
  if (!outOfStock.length) return NextResponse.json({ ok: true });
  revalidateContent(["products"]); // the storefront should stop offering them too
  return NextResponse.json({ ok: false, message: shortageMessage(outOfStock), outOfStock }, { status: 409 });
}
