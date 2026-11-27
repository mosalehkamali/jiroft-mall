import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { disabledFeatureForPath } from "@/lib/features";
import { siteUrl } from "@/lib/safeRedirect";

/**
 * نگهبانِ سمت‌سرور: قابلیت‌های خاموش + پنل مدیریت + داشبورد کاربر.
 *
 * ۱) قابلیت خاموش (store.config.js → features): صفحه و API متعلق به آن ۴۰۴
 *    می‌گیرد — قبل از هر چیز دیگر، پس نه صفحه رندر می‌شود و نه handler اجرا.
 *
 * ۲) پنل مدیریت. چرا middleware و نه layout: layout فقط در بارگذاریِ کاملِ صفحه
 *    دوباره اجرا می‌شود. در ناوبریِ نرم (soft navigation) فقط segmentِ صفحه روی
 *    سرور رندر می‌شود و layout دست‌نخورده می‌ماند. middleware روی *هر* درخواست
 *    (کامل، RSC و prefetch) اجرا می‌شود، پس تنها نقطه‌ی خفه‌کننده‌ی واقعی است.
 *
 * ⚠️ runtime = nodejs (پایین) — چون اینجا mongoose کوئری می‌زند. نقشِ داخل JWT
 * ملاک نیست: عضویتِ زنده‌ی Admin + دسترسی مؤثر از دیتابیس خوانده می‌شود.
 *
 * گیتِ API ها مستقل است (requireAdminPermission) — این لایه جایگزینِ آن نیست.
 */

/** صفحه‌ی «دسترسی ندارید» — عمداً در ADMIN_ROUTE_PERMISSIONS نیست. */
const DENIED_PATH = "/p-admin/403";

function denied(request, reason) {
  const url = new URL(DENIED_PATH, request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.rewrite(url);
}

function featureOff(request, pathname) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "این قابلیت در این فروشگاه فعال نیست" }, { status: 404 });
  }
  // A path no route resolves → the app's own not-found page with status 404.
  return NextResponse.rewrite(new URL("/__feature-disabled__", request.url));
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (disabledFeatureForPath(pathname)) return featureOff(request, pathname);

  const isPanel = pathname.startsWith("/p-user") || pathname.startsWith("/p-admin");
  if (!isPanel) return NextResponse.next();

  const token = request.cookies.get("accessToken")?.value;

  if (!token) {
    const loginUrl = siteUrl("/login-register", request);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/p-admin")) {
    // خودِ صفحه‌ی ۴۰۳ نباید دوباره ارزیابی شود (روتِ ناشناخته → حلقه‌ی rewrite).
    if (pathname === DENIED_PATH) return NextResponse.next();

    const ctx = await getAdminContext({ token });
    if (!ctx) return denied(request, "not-admin");

    if (!canAccessAdminRoute(ctx.permissions, pathname + search)) {
      return denied(request, "forbidden");
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  // همه‌چیز به‌جز فایل‌های ایستا — گیتِ قابلیت باید روی صفحات عمومی و API هم بنشیند.
  matcher: ["/((?!_next/static|_next/image|favicon|brand/|fonts/|images/|sw\\.js|site\\.webmanifest).*)"],
};
