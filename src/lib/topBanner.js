export const TOP_BANNER_KEY = "store_top_banner";
// mobileImage is optional (older saved banners have none); without it phones get `image`.
export const EMPTY_TOP_BANNER = { enabled: false, image: "", mobileImage: "", href: "" };

function validUrl(value, allowPath) {
  if (typeof value !== "string" || value.length > 2000 || /[\\\s]/u.test(value)) return false;
  if (allowPath && value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateTopBanner(value) {
  if (typeof value?.enabled !== "boolean" || typeof value.image !== "string" || typeof value.href !== "string")
    return "تنظیمات بنر نامعتبر است.";
  if (value.mobileImage !== undefined && typeof value.mobileImage !== "string") return "تنظیمات بنر نامعتبر است.";
  if ((value.enabled || value.image) && !validUrl(value.image, false)) return "تصویر بنر را بارگذاری کنید.";
  if (value.mobileImage && !validUrl(value.mobileImage, false)) return "تصویر موبایل بنر نامعتبر است.";
  if ((value.enabled || value.href) && !validUrl(value.href, true)) return "یک مسیر داخلی یا لینک کامل معتبر وارد کنید.";
  return "";
}
