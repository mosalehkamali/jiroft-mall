// این فایل دیگر "use client" نیست و به صورت پیش‌فرض Server Component است
import BannerRenderer from "./BannerRenderer";
import StripBannerRenderer from "./StripBannerRenderer";
import { getActiveBanners } from "@/lib/bannerService";

// مستقیماً از دیتابیس (کش‌شده) خوانده می‌شود — بدون round-trip شبکه‌ای به API خودی
async function getBanners() {
  const banners = await getActiveBanners();
  if (!banners?.length) return null;

  const map = { wide: null, tall1: null, tall2: null, strip: null };
  banners.forEach((b) => {
    if (b.position === "wide" && !map.wide) map.wide = b;
    if (b.position === "tall-1" && !map.tall1) map.tall1 = b;
    if (b.position === "tall-2" && !map.tall2) map.tall2 = b;
    if (b.position === "strip" && !map.strip) map.strip = b;
  });
  return map;
}

/**
 * BannerSection (Server Component)
 */
export default async function BannerSection() {
  const banners = await getBanners();

  if (!banners || (!banners.wide && !banners.tall1 && !banners.tall2 && !banners.strip)) {
    return null; // یا یک کامپوننت فال‌بک/اسکلتون نشان دهید
  }

  const tiles = [banners.wide, banners.tall1, banners.tall2].filter(Boolean);
  return (
    <section className="storefront-banners site-container" dir="rtl">
      {tiles.length > 0 && (
        <div className="campaign-mosaic">
          {tiles.map((banner) => (
            <div key={banner.position} className={banner.position === "wide" ? "campaign-wide" : undefined}>
              <BannerRenderer banner={banner} />
            </div>
          ))}
        </div>
      )}
      {banners.strip && (
        <div className="campaign-strip">
          <StripBannerRenderer banner={banners.strip} />
        </div>
      )}
    </section>
  );
}
