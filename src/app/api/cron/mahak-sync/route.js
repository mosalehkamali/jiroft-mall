import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { runMahakSync } from "base/services/mahak/sync.service";
import { retryMahakInvoices } from "base/services/mahak/order.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/mahak-sync — hourly (vercel.json): products, prices and stock
 * from every Mahak account, then invoices that did not go through earlier.
 * Vercel Cron only (Authorization: Bearer CRON_SECRET).
 */
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDB();
  const sync = await runMahakSync({ budgetMs: 40000 });
  if (sync.changed) revalidateContent(["products", "navbar", "categories"]);
  const invoices = await retryMahakInvoices();
  return NextResponse.json({ ok: true, sync, invoices });
}
