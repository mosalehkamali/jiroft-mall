import { NextResponse } from "next/server";
import { getCachedRate } from "@/lib/Exchangerate";
import { PRICING_MODE } from "@/lib/currency";

// GET /api/exchange-rate — عمومی برای client components.
// در حالتِ قیمت‌گذاریِ direct (store.config.js) همیشه ۱ است.
export async function GET() {
  try {
    const rate = await getCachedRate();
    if (!rate) {
      return NextResponse.json({ error: "نرخ تبدیل تنظیم نشده" }, { status: 404 });
    }
    return NextResponse.json({ currency: "EUR", rateToToman: rate, mode: PRICING_MODE });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
