import storeConfig from "base/store.config";
export const metadata = {
  title: `انتخاب محصول مناسب با ابزار مچ ${storeConfig.brand.name}`,
  description:
    "با مقایسه شاخص‌های فنی و محصول فعلی خود، نزدیک‌ترین تجهیزات تنیس و پدل به سبک بازی و نیازتان را پیدا کنید.",
  alternates: { canonical: "/match" },
};

export default function MatchLayout({ children }) {
  return children;
}
