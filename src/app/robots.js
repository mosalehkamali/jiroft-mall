const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const PRIVATE_PATHS = ["/p-admin/", "/p-user/", "/api/", "/checkout/", "/cart/", "/login-register", "/auth/"];

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        // Next.js adds ?dpl=... to CSS/JS URLs. This more-specific rule
        // keeps rendering assets crawlable despite the query-string block.
        allow: [
          "/",
          "/_next/static/",
          // Public product batches are needed to render the rest of brand listings.
          // Include the query delimiter so other API paths are not allowed.
          "/api/brands/grouped?",
          // A page-only query (?page=N) is a real listing page with its own canonical.
          // Catalogue pages live at any root slug (departments, categories, brands),
          // so the rule is generic; the longer private rules below still win.
          "/*?page=*$",
        ],
        disallow: [
          ...PRIVATE_PATHS,
          ...PRIVATE_PATHS.map((path) => `${path.replace(/\/$/, "")}*?page=`),
          // Limit crawling of parameterized pages; static assets are allowed above.
          // A crawl restriction does not itself prevent URL indexing.
          "/*?*",
          "/*?page=*&*$",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
