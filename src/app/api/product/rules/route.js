/**
 * GET /api/product/rules?category=<id>
 *
 * The resolved product rules (store.config.js → catalog.product, including the
 * category's own overrides) for the admin product forms, so the form shows,
 * hides and requires exactly what the server will enforce.
 */
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { rulesForCategory } from "base/services/productRules.service";

export async function GET(req) {
  const { denied } = await requireAdminPermission(["products.create", "products.edit"], { mode: "any" });
  if (denied) return denied;

  const category = new URL(req.url).searchParams.get("category");
  if (category && !mongoose.isValidObjectId(category)) {
    return NextResponse.json({ message: "شناسه دسته‌بندی نامعتبر است" }, { status: 400 });
  }
  return NextResponse.json({ rules: await rulesForCategory(category || null) });
}
