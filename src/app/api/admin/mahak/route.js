import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";
import Product from "base/models/Product";
import { MahakAccount, MahakLink } from "base/models/Mahak";
import { accountCredentials, MAHAK } from "@/lib/mahak/config";
import { runMahakSync } from "base/services/mahak/sync.service";
import { postOrderInvoices, retryMahakInvoices } from "base/services/mahak/order.service";
import { revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";

export const maxDuration = 60;

/** GET /api/admin/mahak — connection status, counts, what needs attention. */
export async function GET() {
  const { denied } = await requireAdminPermission("mahak.view");
  if (denied) return denied;
  await connectToDB();

  const states = await MahakAccount.find().lean();
  const accounts = await Promise.all(
    MAHAK.accounts.map(async ({ key, label }) => {
      const s = states.find((x) => x.key === key);
      const [items, inStock] = await Promise.all([
        MahakLink.countDocuments({ account: key, gone: false }),
        MahakLink.countDocuments({ account: key, gone: false, stock: { $gt: 0 } }),
      ]);
      return {
        key,
        label,
        configured: !!accountCredentials(key),
        visitorId: s?.visitorId ?? null,
        lastSyncAt: s?.lastSyncAt ?? null,
        lastError: s?.lastError || "",
        waiting: s?.dirty?.length || 0,
        items,
        inStock,
      };
    }),
  );

  // in stock but hidden because there is no image yet — the admin's to-do list
  const stocked = await MahakLink.distinct("product", { gone: false, stock: { $gt: 0 } });
  const needImage = await Product.find({ _id: { $in: stocked }, $or: [{ mainImage: "" }, { mainImage: null }] })
    .select("name sku")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const [published, failedOrders] = await Promise.all([
    Product.countDocuments({ _id: { $in: await MahakLink.distinct("product") }, isActive: true }),
    Order.find({ "mahak.state": { $in: ["pending", "failed"] } })
      .select("trackingCode createdAt totalPrice +mahak")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);
  return NextResponse.json({ accounts, published, needImage, needImageCount: needImage.length, failedOrders });
}

/** POST /api/admin/mahak { action: "sync" } | { action: "retry", orderId? } */
export async function POST(req) {
  const { denied } = await requireAdminPermission("mahak.sync");
  if (denied) return denied;
  await connectToDB();
  const { action, orderId } = await req.json().catch(() => ({}));

  if (action === "sync") {
    const sync = await runMahakSync({ budgetMs: 45000 });
    if (sync.changed) revalidateContent(["products", "navbar", "categories"]);
    return NextResponse.json({ sync });
  }
  if (action === "retry") {
    const result = orderId ? await postOrderInvoices(orderId) : await retryMahakInvoices();
    return NextResponse.json({ result });
  }
  return NextResponse.json({ message: "عملیات نامعتبر است" }, { status: 400 });
}
