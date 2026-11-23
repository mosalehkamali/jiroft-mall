/**
 * POST /api/payments/rozpardakht
 *   { orderId, action: "confirm", code }  → the SMS code; 200 { status: "paid", trackingCode }
 *   { orderId, action: "resend" }         → a new SMS code
 *
 * Only for the logged-in owner of an unpaid RozPardakht order (created by
 * POST /api/checkout). See services/rozPayment.service.js.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import { RozFlowError, confirmRozPayment, resendRozCode } from "base/services/rozPayment.service";
import { RozError } from "base/services/payments/rozpardakht";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const token = (await cookies()).get("accessToken")?.value;
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
  try {
    await connectToDB();
    const { orderId, action, code } = await req.json();
    if (action === "resend") {
      await resendRozCode({ orderId, userId: user.userId });
      return NextResponse.json({ message: "کد تأیید دوباره پیامک شد" });
    }
    if (action === "confirm") return NextResponse.json(await confirmRozPayment({ orderId, userId: user.userId, code }));
    return NextResponse.json({ message: "درخواست نامعتبر" }, { status: 400 });
  } catch (err) {
    if (err instanceof RozFlowError) return NextResponse.json({ message: err.message }, { status: err.status });
    if (err instanceof RozError) return NextResponse.json({ message: err.message, code: err.code }, { status: 502 });
    console.error("[payments/rozpardakht]", err);
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
