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
    imageSizes: [64, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
    ],
  },
};

export default nextConfig;
