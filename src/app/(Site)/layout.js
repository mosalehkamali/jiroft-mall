// Root layout of the storefront. Identity and theme come from store.config.js.

import storeConfig from "base/store.config";
import "@/app/globals.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { getActiveTopBanner } from "base/services/topBanner.service";
import Navbar from "@/components/features/navbar/Navbar";
import WhatsAppSupport from "@/components/features/WhatsAppSupport/WhatsAppSupport";
import Footer from "@/components/features/footer/Footer";
import PushOptInBanner from "@/components/features/push/PushOptInBanner";

import { getCachedNavbar } from "@/lib/navbarService";
import { getSiteFooter } from "base/services/siteFooter.service";
import { isFeatureEnabled } from "@/lib/features";
import { UserProvider } from "@/components/features/auth/UserContext";
import CartCleanup from "@/components/features/cart/CartCleanup";
import ScrollToTop from "@/components/common/ScrollToTop";
import NavigationLoader from "@/components/common/NavigationLoader";
import InitialLoadLoader from "@/components/common/InitialLoadLoader";
import MicrosoftClarity from "@/components/common/MicrosoftClarity";
import StoreHead from "@/components/common/StoreHead";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const { brand } = storeConfig;

function siteImageFallbackScript(src) {
  return `
    (() => {
      const fallbackSrc = ${JSON.stringify(src)};

      const applyFallback = (img) => {
        if (!(img instanceof HTMLImageElement)) return;

        const fallbackUrl = new URL(fallbackSrc, window.location.origin).href;
        const currentSrc = img.currentSrc || img.src || "";

        if (img.dataset.fallbackApplied === "true" || currentSrc === fallbackUrl) {
          return;
        }

        img.dataset.fallbackApplied = "true";
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");

        const picture = img.parentElement?.tagName === "PICTURE" ? img.parentElement : null;
        picture?.querySelectorAll("source").forEach((source) => {
          source.removeAttribute("srcset");
        });

        img.src = fallbackSrc;
      };

      window.addEventListener(
        "error",
        (event) => {
          applyFallback(event.target);
        },
        true
      );
    })();
  `;
}

const defaultTitle = brand.tagline ? `${brand.name} | ${brand.tagline}` : brand.name;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: defaultTitle, template: `%s | ${brand.name}` },
  description: brand.description,
  keywords: brand.keywords,
  authors: [{ name: brand.nameEn || brand.name }],
  creator: brand.nameEn || brand.name,
  publisher: brand.nameEn || brand.name,
  applicationName: brand.nameEn || brand.name,
  alternates: isFeatureEnabled("articles")
    ? { types: { "application/rss+xml": `${SITE_URL}/rss.xml` } }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: brand.ogLocale,
    url: SITE_URL,
    siteName: brand.name,
    title: defaultTitle,
    description: brand.description,
    images: [{ url: brand.ogImage, width: 1200, height: 630, alt: brand.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: brand.description,
    images: [brand.ogImage],
  },
  icons: { icon: brand.favicon, shortcut: brand.favicon, apple: brand.favicon },
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }) {
  // ⚠️ هیچ `cookies()`/`headers()` در این layout صدا زده نمی‌شود تا کل درخت `(Site)`
  // بتواند static/ISR باقی بماند. وضعیت کاربر در جزیره‌ی کلاینت `UserProvider` مدیریت می‌شود.
  const [navData, footer, topBanner] = await Promise.all([getCachedNavbar(), getSiteFooter(), getActiveTopBanner()]);

  const sameAs = footer.socials.filter((s) => s.enabled && s.url).map((s) => s.url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${SITE_URL}/#organization`,
    name: brand.name,
    url: SITE_URL,
    logo: `${SITE_URL}${brand.logo}`,
    image: `${SITE_URL}${brand.ogImage}`,
    description: brand.description,
    ...(sameAs.length ? { sameAs } : {}),
  };

  return (
    <html lang={brand.lang} dir={brand.dir}>
      <head>
        <StoreHead />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: siteImageFallbackScript(brand.imageFallback),
          }}
        />
      </head>

      <body className="bg-[var(--color-background)] text-[var(--color-text)]">
        <MicrosoftClarity />
        <InitialLoadLoader />
        <NavigationLoader />
        <UserProvider>
          <ScrollToTop />
          <CartCleanup />

          <Navbar navData={navData} topBanner={topBanner} />

          {brand.contact?.whatsapp ? <WhatsAppSupport /> : null}
          {isFeatureEnabled("push") ? <PushOptInBanner /> : null}

          <main className="min-h-screen">{children}</main>

          <Footer footer={footer} />
        </UserProvider>

        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={brand.dir === "rtl"}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}
