import storeConfig from "./store.config.js";

// Fixed above-the-fold assets of the product page, announced in a response
// header so the browser fetches them while the HTML is still streaming. The
// font files are the local Vazirmatn of globals.css — only when no external
// font stylesheet replaces it. Fonts need anonymous CORS to reuse the same
// request as @font-face.
const productPagePreload = [
  ...(storeConfig.theme.fontStylesheet
    ? []
    : ["Regular", "Bold"].map(
        (w) => `</fonts/invoice/Vazirmatn-${w}.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin=anonymous`,
      )),
  ...(storeConfig.brand.logo ? [`<${storeConfig.brand.logo}>; rel=preload; as=image`] : []),
].join(", ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  // کش سمت‌کلاینت روتر: صفحاتی که یک‌بار بازدید/پری‌فچ شده‌اند تا این مدت
  // بدون درخواست مجدد به سرور نمایش داده می‌شوند (تجربه‌ی SPA و ناوبری آنی).
  //  - dynamic: صفحات داینامیک (لیست محصول، صفحات دسته/برند) ۳۰ ثانیه
  //  - static : صفحات ایستا/ISR تا ۳ دقیقه
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // The magazine contains no server-rendered user data; Vercel's CDN may cache it.
  async headers() {
    return [
      ...(productPagePreload
        ? [{ source: "/products/:productSlug", headers: [{ key: "Link", value: productPagePreload }] }]
        : []),
      {
        source: "/content/:path*",
        headers: [
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },

  // Add a client's own legacy-URL redirects here when migrating an old site.
  async redirects() {
    return [];
  },

  images: {
    // بهینه‌سازی تصاویر از طریق ImageKit انجام می‌شود (نه Image Optimization ورسل).
    // منطق در src/lib/imagekitLoader.js
    loader: "custom",
    loaderFile: "./src/lib/imagekitLoader.js",
    // تعداد سایزهای srcset محدود است تا ترنسفورم/بندویدثِ مصرفی کمتر شود.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
    ],
  },
};

export default nextConfig;
