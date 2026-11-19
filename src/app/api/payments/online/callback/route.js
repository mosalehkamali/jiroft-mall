/**
 * GET|POST /api/payments/online/callback?orderId=…&Authority=…&Status=OK|NOK
 *
 * Where ZarinPal sends the customer back. The payment is verified server to
 * server (services/onlinePayment.service.js); the query string itself proves
 * nothing.
 *
 * The answer is a small page that navigates on by itself, not an HTTP
 * redirect: this request arrives from zarinpal.com, and the login cookies are
 * SameSite=strict, so a redirect chain would reach the account pages without
 * them and the customer would land on the login form. A navigation started by
 * our own page is same-site and carries the cookies.
 */
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { handleGatewayReturn } from "base/services/onlinePayment.service";

export const dynamic = "force-dynamic";

async function handle(req) {
  const url = new URL(req.url);
  let result = { status: "invalid" };
  try {
    await connectToDB();
    result = await handleGatewayReturn({
      orderId: url.searchParams.get("orderId"),
      authority: url.searchParams.get("Authority"),
      status: url.searchParams.get("Status"),
    });
  } catch (err) {
    console.error("[payments/online/callback]", err);
    result = { status: "error" };
  }
  const target =
    result.status === "paid"
      ? `/p-user/orders/success/${encodeURIComponent(result.trackingCode)}?paid=online`
      : `/p-user/payments/checkout?payment=${result.status}`; // cart is still in the browser: retry is possible
  const href = JSON.stringify(target).replace(/</g, "\u003c");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target.replace(/"/g, "&quot;")}"><title>بازگشت از درگاه</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:3rem">در حال بازگشت به فروشگاه… <a href="${target.replace(/"/g, "&quot;")}">ادامه</a><script>location.replace(${href})</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
