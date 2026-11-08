/**
 * store.config.js — the one file you edit per client.
 *
 * Everything that makes a store *this* store lives here: identity, theme,
 * which features exist, which product data is required where, and the
 * commerce rules (pricing, purchasing, inventory, delivery).
 *
 * The file must stay plain data (no imports, no env access): it is read by
 * server code, client components, workers and tests alike.
 *
 * Full reference: docs/CUSTOMIZATION.md
 */

const storeConfig = {
  /* ── Identity ─────────────────────────────────────────────────────────── */
  brand: {
    name: "فروشگاه نمونه",
    nameEn: "Sample Store",
    tagline: "فروشگاه آنلاین",
    description: "خرید آنلاین محصولات با ضمانت اصالت و ارسال سریع.",
    keywords: ["فروشگاه آنلاین", "خرید اینترنتی"],
    logo: "/brand/logo.svg",
    favicon: "/brand/favicon.svg",
    ogImage: "/brand/og.svg",
    // Fallback for any <img> that fails to load (see the (Site) layout).
    imageFallback: "/brand/placeholder.svg",
    lang: "fa", // <html lang> and the homepage hreflang
    ogLocale: "fa_IR",
    dir: "rtl",
    contact: {
      phone: "",
      email: "",
      address: "",
      whatsapp: "", // digits incl. country code, e.g. "989120000000" — empty hides the button
    },
    social: {
      instagram: "",
      telegram: "",
      x: "",
    },
  },

  /* ── Theme ────────────────────────────────────────────────────────────── */
  // Emitted as CSS variables on :root; every storefront component reads these.
  theme: {
    colors: {
      primary: "#2563eb",
      primaryDark: "#1d4ed8",
      secondary: "#f59e0b",
      dark: "#111827",
      text: "#0f172a",
      background: "#ffffff",
      border: "#e5e7eb",
      surface: "#f1f5f9",
      surfaceSoft: "#f8fafc",
      muted: "#6b7280",
    },
    radius: "8px",
    fontFamily: '"Vazirmatn", system-ui, -apple-system, sans-serif',
    // Any stylesheet that declares the font above (Google Fonts, a CDN…).
    fontStylesheet: "", // "" = the local Vazirmatn in globals.css
    // Browser UI colour (mobile address bar).
    browserThemeColor: "#ffffff",
  },

  /* ── Storefront layout ────────────────────────────────────────────────── */
  // Order = render order. Sections owned by a disabled feature are skipped.
  // Available: hero, banners, departments, compareAndFinder, bestSellers,
  // offers, featuredLimitedEdition, brands, articles, athletes
  home: {
    title: "فروشگاه آنلاین",
    sections: ["hero", "banners", "bestSellers", "offers", "brands", "articles"],
  },

  // Product page extras. icon: shield | return | card | truck | store |
  // support | badge | gift. `feature` hides an item while that feature is off.
  productPage: {
    assurances: [
      { icon: "shield", label: "ضمانت اصل بودن کالا" },
      { icon: "return", label: "۷ روز ضمانت بازگشت کالا" },
      { icon: "card", label: "امکان پرداخت قسطی", feature: "installments" },
      { icon: "truck", label: "ارسال به سراسر کشور" },
    ],
  },

  // Links to a disabled feature's pages are dropped automatically.
  navigation: {
    // Shown next to the category menu button in the header.
    header: [
      { label: "همه محصولات", href: "/products" },
      { label: "کالکشن‌ها", href: "/collection" },
      { label: "مجله", href: "/content" },
    ],
    // Footer link columns.
    footer: [
      {
        title: "دسترسی سریع",
        links: [
          { label: "همه محصولات", href: "/products" },
          { label: "مجله", href: "/content" },
          { label: "کالکشن‌ها", href: "/collection" },
        ],
      },
      {
        title: "خدمات مشتریان",
        links: [
          { label: "راهنمای خرید", href: "/how-to-order" },
          { label: "ارسال و تحویل", href: "/shipping" },
          { label: "بازگشت کالا", href: "/returns" },
          { label: "سوالات متداول", href: "/faq" },
        ],
      },
      {
        title: "درباره ما",
        links: [
          { label: "درباره ما", href: "/about" },
          { label: "تماس با ما", href: "/contact" },
          { label: "قوانین و مقررات", href: "/terms" },
        ],
      },
    ],
  },

  /* ── Features ─────────────────────────────────────────────────────────── */
  // true = on. A feature whose dependency is off is off too (see
  // src/lib/features.js for what each one owns and depends on). Turning a
  // feature off never deletes its data; turning it back on restores it.
  features: {
    // catalog
    brands: true,
    series: false, // product lines inside a brand            (needs brands)
    limitedEditions: false, // brand capsule collections           (needs brands)
    departments: false, // top-level catalog sections, e.g. sports
    targetAudience: false, // men / women / kids / unisex
    technicalStats: false, // per-category numeric stats + radar chart
    compare: true,
    collections: true, // campaign / collection landing pages
    articles: true, // blog / magazine
    secondHand: false, // used-product listings
    orderFlows: false, // multi-step product customisation (services, add-ons)

    // sports-specific
    athletes: false, // (needs departments)
    racketFinder: false, // guided racket questionnaire (needs departments, technicalStats)

    // customers
    reviews: true,
    wishlist: true,
    tickets: true,
    contactForm: true,
    newsletter: true,
    broadcasts: true, // admin → customer notifications
    push: false, // web push (needs VAPID keys)
    googleAuth: false, // needs GOOGLE_CLIENT_ID / SECRET

    // money
    discounts: true, // discount rules, flash sales, quantity tiers, coupon codes
    wallet: false,
    reviewCredit: false, // wallet credit for reviews  (needs reviews, wallet)
    coach: false, // coach codes + coach wallets          (needs wallet)
    installments: false, // cheque-based instalment payments
    orderEur: false, // manual EUR bookkeeping on orders

    // operations
    warehouse: false, // barcode tracking in a separate warehouse DB
    aiAssistant: false, // admin data assistant (needs GEMINI_API_KEY)
    aiProductDraft: false, // AI-drafted product data + prompt settings (needs departments, GEMINI_API_KEY)
  },

  /* ── Catalog data rules ───────────────────────────────────────────────── */
  catalog: {
    // Label of the "departments" level when that feature is on.
    departmentLabel: "دپارتمان",
    departmentLabelPlural: "دپارتمان‌ها",

    product: {
      /*
       * Built-in product fields. Every key is optional; omitted props fall
       * back to the defaults in src/lib/productRules.js.
       *
       *   use        false = the store does not have this field at all
       *   required   false | "draft" | "published" | "purchasable"
       *              the first stage at which a value is mandatory
       *              (draft = always, published = before it can go live,
       *               purchasable = it may be shown without it, not sold)
       *   admin      shown in the admin form (default: use)
       *   public     shown to customers (default true)
       *   filterable offered as a storefront filter
       *   searchable matched by the storefront search
       *   min / max / minLength / maxLength / pattern   validation
       *
       * `name` is always used and always required.
       */
      fields: {
        sku: { label: "کد کالا (SKU)", public: false, searchable: true },
        category: { label: "دسته‌بندی", required: "published", filterable: true },
        brand: { label: "برند", filterable: true, searchable: true },
        shortDescription: { label: "توضیح کوتاه", maxLength: 500 },
        longDescription: { label: "توضیحات کامل" },
        mainImage: { label: "تصویر اصلی", required: "published" },
        gallery: { label: "گالری تصاویر" },
        basePrice: { label: "قیمت پایه", required: "purchasable", min: 0 },
        stock: { label: "موجودی" }, // only with commerce.inventory.mode = "stock"
        color: { label: "رنگ" },
        tag: { label: "برچسب‌ها", searchable: true },
        label: { label: "نشان ویژه" },
      },

      /*
       * Store-wide extra fields, stored in product.customFields.
       *   type: text | textarea | number | boolean | select | date | url
       * plus every rule prop above (and `options` for select).
       */
      customFields: [
        // { key: "warrantyMonths", label: "گارانتی (ماه)", type: "number", min: 0, max: 60 },
        // { key: "supplierCode", label: "کد تأمین‌کننده", type: "text", public: false, required: "published" },
      ],

      /*
       * Per-category overrides, keyed by category slug. A rule applies to the
       * category and every category below it; the most specific one wins.
       *   fields        same shape as above, merged over the global rules
       *   customFields  appended (same key = replaces the global one)
       *   purchase      overrides commerce.purchase.mode for these products
       *
       * Categories also carry admin-editable attributes (Admin → Categories),
       * for data the store owner manages without a code change.
       */
      categoryRules: {
        // "gift-cards": { fields: { mainImage: { required: false } }, purchase: "inquiry" },
      },
    },
  },

  /* ── Commerce rules ───────────────────────────────────────────────────── */
  commerce: {
    currency: {
      label: "تومان",
      locale: "fa-IR",
    },

    pricing: {
      // "direct":   basePrice / variant price ARE the selling price.
      // "exchange": prices are stored in a foreign currency and multiplied by
      //             the admin-managed exchange rate (Admin → Finance).
      mode: "direct",
      // Final unit prices are rounded down to a multiple of this.
      roundTo: 1,
    },

    purchase: {
      // "cart":    products are bought online (cart + checkout).
      // "inquiry": products are shown with a contact call-to-action, no cart.
      // "catalog": showcase only — no price-based purchase anywhere.
      mode: "cart",
      inquiryText: "برای استعلام قیمت و سفارش با ما تماس بگیرید",
    },

    inventory: {
      // "none":  stock is not tracked; anything purchasable can be ordered.
      // "stock": products/variants carry a stock count; checkout reserves it,
      //          deleting an unpaid/cancelled order returns it.
      mode: "none",
    },

    delivery: {
      // "shipping": a delivery address is required at checkout.
      // "pickup":   no address; the order is collected in store.
      // "digital":  no address; nothing is shipped.
      mode: "shipping",
    },

    // Offered at checkout. INSTALLMENT also needs features.installments.
    paymentMethods: ["BANK_RECEIPT"],
  },
};

export default storeConfig;
