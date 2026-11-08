// 404 سراسری برای آدرس‌های نامعتبر.
// چون root layout داخل گروهِ مسیرِ (Site) قرار دارد و app/layout.js نداریم،
// این فایل باید خودش <html> و <body> و استایل سراسری را فراهم کند.
import "@/app/globals.css";
import storeConfig from "base/store.config";
import StoreHead from "@/components/common/StoreHead";
import NotFoundContent from "@/components/ui/NotFoundContent";

export const metadata = {
  title: "صفحه پیدا نشد",
};

export default function NotFound() {
  return (
    <html lang={storeConfig.brand.lang} dir={storeConfig.brand.dir}>
      <head>
        <StoreHead />
      </head>
      <body
        className="bg-[var(--color-background)] text-[var(--color-text)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <main className="min-h-screen">
          <NotFoundContent />
        </main>
      </body>
    </html>
  );
}
