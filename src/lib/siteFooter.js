// Footer content (Admin → صفحات سایت → فوتر). Pure: used by the admin form, the API and the storefront.
// Stored as one SiteSetting; until the first save every value comes from store.config.js.

import storeConfig from "base/store.config";

export const SITE_FOOTER_SETTING_KEY = "site_footer";
export const SITE_FOOTER_CACHE_TAG = "site-footer";

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "whatsapp", label: "واتس‌اپ" },
  { key: "x", label: "ایکس (توییتر)" },
  { key: "youtube", label: "یوتیوب" },
  { key: "linkedin", label: "لینکدین" },
];

export const FOOTER_LIMITS = { sections: 8, links: 20, phones: 5, text: 300, description: 1000 };

const { brand, navigation } = storeConfig;

export function defaultSiteFooter() {
  const contact = brand.contact || {};
  return {
    logo: brand.logoLight || brand.logo || "",
    description: brand.description || "",
    phones: contact.phone ? [contact.phone] : [],
    address: contact.address || "",
    email: contact.email || "",
    socials: SOCIAL_PLATFORMS.map(({ key }) => ({
      key,
      url: brand.social?.[key] || "",
      enabled: Boolean(brand.social?.[key]),
    })),
    sections: (navigation?.footer || []).map((s) => ({
      title: s.title,
      links: (s.links || []).map((l) => ({ label: l.label, href: l.href })),
    })),
    copyright: `© {year} تمامی حقوق برای ${brand.name} محفوظ است.`,
    newsletter: {
      title: "عضویت در خبرنامه",
      subtitle: "از جدیدترین محصولات و تخفیف‌های ویژه با خبر شوید",
      placeholder: "ایمیل خود را وارد کنید",
      button: "عضویت",
      subscribedTitle: "شما عضو خبرنامه هستید",
      subscribedSubtitle: "از اینکه ما را دنبال می‌کنید سپاسگزاریم.",
    },
  };
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Stored value → full footer. Unknown/missing keys fall back to the defaults. */
export function normalizeSiteFooter(value) {
  const def = defaultSiteFooter();
  if (!value || typeof value !== "object") return def;
  const pick = (key) => (typeof value[key] === "string" ? value[key] : def[key]);
  const stored = Array.isArray(value.socials) ? value.socials : [];
  return {
    logo: pick("logo"),
    description: pick("description"),
    phones: Array.isArray(value.phones) ? value.phones.map(str).filter(Boolean) : def.phones,
    address: pick("address"),
    email: pick("email"),
    socials: def.socials.map((d) => {
      const s = stored.find((x) => x?.key === d.key);
      return s ? { key: d.key, url: str(s.url), enabled: Boolean(s.enabled) } : d;
    }),
    sections: Array.isArray(value.sections)
      ? value.sections.map((s) => ({
          title: str(s?.title),
          links: (Array.isArray(s?.links) ? s.links : []).map((l) => ({ label: str(l?.label), href: str(l?.href) })),
        }))
      : def.sections,
    copyright: pick("copyright"),
    newsletter: Object.fromEntries(
      Object.entries(def.newsletter).map(([k, d]) => [k, typeof value.newsletter?.[k] === "string" ? value.newsletter[k] : d])
    ),
  };
}

const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;
const HTTP_URL = /^https?:\/\/\S+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin payload → { footer, errors }. Everything is trimmed; nothing unsafe is kept. */
export function validateSiteFooter(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { footer: null, errors: ["داده‌ی فوتر نامعتبر است"] };
  const footer = normalizeSiteFooter(input);
  const L = FOOTER_LIMITS;

  for (const key of ["logo", "address", "email", "copyright"]) footer[key] = str(footer[key]);
  footer.description = str(footer.description);
  for (const k of Object.keys(footer.newsletter)) footer.newsletter[k] = str(footer.newsletter[k]);

  if (footer.description.length > L.description) errors.push(`توضیح فوتر حداکثر ${L.description} کاراکتر است`);
  for (const v of [footer.address, footer.copyright, ...Object.values(footer.newsletter), ...footer.phones]) {
    if (v.length > L.text) errors.push(`هر متن حداکثر ${L.text} کاراکتر است`);
  }
  if (footer.logo && !SAFE_HREF.test(footer.logo)) errors.push("آدرس لوگو باید با / یا https:// شروع شود");
  if (footer.email && !EMAIL.test(footer.email)) errors.push("ایمیل نامعتبر است");
  if (footer.phones.length > L.phones) errors.push(`حداکثر ${L.phones} شماره تلفن`);
  if (footer.phones.some((p) => !/^[+\d۰-۹٠-٩\s()-]+$/.test(p))) errors.push("شماره تلفن فقط می‌تواند شامل رقم، فاصله، + و - باشد");

  for (const s of footer.socials) {
    const { label } = SOCIAL_PLATFORMS.find((p) => p.key === s.key);
    if (s.url && !HTTP_URL.test(s.url)) errors.push(`لینک ${label} باید با https:// شروع شود`);
    if (s.enabled && !s.url) errors.push(`برای فعال‌کردن ${label} لینک آن را وارد کنید`);
  }

  if (footer.sections.length > L.sections) errors.push(`حداکثر ${L.sections} ستون لینک`);
  footer.sections.forEach((s, i) => {
    if (!s.title) errors.push(`عنوان ستون ${i + 1} خالی است`);
    if (s.links.length > L.links) errors.push(`ستون «${s.title}» حداکثر ${L.links} لینک دارد`);
    s.links.forEach((l, j) => {
      if (!l.label || !l.href) errors.push(`لینک ${j + 1} در ستون «${s.title || i + 1}» متن و آدرس لازم دارد`);
      else if (!SAFE_HREF.test(l.href)) errors.push(`آدرس «${l.label}» باید با / یا https:// شروع شود`);
      if (l.label.length > L.text || l.href.length > L.text) errors.push(`هر متن حداکثر ${L.text} کاراکتر است`);
    });
  });

  return { footer, errors: [...new Set(errors)] };
}

/** `{year}` → the current year in Persian digits. */
export function renderCopyright(text, date = new Date()) {
  const year = date.getFullYear().toLocaleString("fa-IR", { useGrouping: false });
  return String(text || "").replaceAll("{year}", year);
}

/** Display phone → `tel:` href (Persian/Arabic digits to ASCII, separators dropped). */
export function telHref(phone) {
  const ascii = String(phone).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}
