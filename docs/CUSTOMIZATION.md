# Customizing a store

Every client store is its **own copy** of this repository. Configuration
covers what most stores need; anything beyond it is ordinary code you are free
to change in that copy. This page documents the configuration.

All of it lives in [`store.config.js`](../store.config.js) — plain data, read
by the server, the browser, workers and tests alike. After editing it, restart
`npm run dev` (or rebuild for production).

- [1. Identity and theme](#1-identity-and-theme)
- [2. Storefront layout](#2-storefront-layout)
- [3. Features](#3-features)
- [4. Product data rules](#4-product-data-rules)
- [5. Commerce rules](#5-commerce-rules)
- [6. Beyond configuration](#6-beyond-configuration)
- [7. Starting a new client](#7-starting-a-new-client)

---

## 1. Identity and theme

```js
brand: {
  name, nameEn, tagline, description, keywords,
  logo, favicon, ogImage, imageFallback,   // files under public/brand/
  lang, ogLocale, dir,                     // "fa", "fa_IR", "rtl" (lang = <html lang> + homepage hreflang)
  contact: { phone, email, address, whatsapp },  // empty = not shown
  social: { instagram, telegram, x },            // empty = not shown
},
theme: {
  colors: { primary, primaryDark, secondary, dark, text, background,
            border, surface, surfaceSoft, muted },
  radius, fontFamily, fontStylesheet, browserThemeColor,
},
```

- **Colours** become CSS variables (`--color-primary`, …) on every page
  (`src/components/common/StoreHead.jsx`). Components use the variables —
  never hard-coded colours — so changing `theme.colors` re-themes the
  storefront, the customer dashboard and the parts of the admin that show
  store content. Emails can't use CSS variables, so `src/lib/emailService.js`
  reads the same values directly.
- **Fonts**: `fontFamily` is the CSS font stack; `fontStylesheet` any stylesheet
  that declares it (Google Fonts, a CDN). `""` (the default) uses the Vazirmatn
  shipped in `public/fonts/invoice/` (declared in `globals.css`, preloaded on
  product pages — the PDF invoices use the same files); with another family and
  `""` the browser falls back to system fonts. Extra
  display fonts for banners/collections: add an `@font-face` in
  `src/app/globals.css` and list it in `src/lib/eventFonts.js`.
- **Logo & images**: replace the placeholders in `public/brand/`. Use a
  PNG/JPG for `NEXT_PUBLIC_LOGO_URL` (emails and PDF invoices) — many mail
  clients don't show SVG.
- The **admin panel** keeps its own neutral theme (`src/styles/admin-theme.css`);
  it shows the store's name.

## 2. Storefront layout

```js
home: { title, sections: ["hero", "banners", "bestSellers", "offers", "brands", "articles"] },
productPage: { assurances: [{ icon: "shield", label: "…", feature?: "installments" }] },
navigation: {
  header: [{ label, href }],                 // next to the category menu
  footer: [{ title, links: [{ label, href }] }],
},
```

| home section | shows | needs feature |
|---|---|---|
| `hero` | home slider (Admin → صفحات سایت → اسلایدر) | — |
| `banners` | promotional banners | — |
| `departments` | department grid | `departments` |
| `compareAndFinder` | compare / racket-finder banners | `compare` or `racketFinder` |
| `bestSellers`, `offers` | product sliders (Admin → اسلایدرهای محصول) | — |
| `featuredLimitedEdition` | featured limited-edition banner | `limitedEditions` |
| `brands` | brand ticker | `brands` |
| `articles` | featured articles | `articles` |
| `athletes` | athletes showcase | `athletes` |

Order in the array = order on the page. A section whose feature is off is
skipped and its data is never queried. Links in `navigation` that point into a
disabled feature (e.g. `/content` without `articles`) are dropped automatically.

CMS pages (about, contact, terms, FAQ, returns, shipping, payment, how to
order) are edited in Admin → صفحات سایت; their first-run defaults are in
`src/lib/pageDefaults.js`.

## 3. Features

```js
features: { brands: true, articles: true, wallet: false, … }
```

A feature is **on only if it is `true` and every feature it depends on is
on**. When a feature is off:

| layer | effect |
|---|---|
| storefront & dashboard pages | 404 (`src/middleware.js`) |
| API routes | 404 JSON |
| admin | its sidebar entry, pages and permissions disappear — for every admin, full access included |
| UI elsewhere | menus, home sections, product-page tabs, article blocks, checkout options, dashboard links hide |
| notifications, push, emails | not sent |
| crons / workers | do nothing |
| data | **untouched** — switch it back on and everything is still there |

| feature | what it is | depends on |
|---|---|---|
| `brands` | brands, brand pages, brand filter | — |
| `series` | product lines inside a brand | brands |
| `limitedEditions` | brand capsule collections | brands |
| `departments` | a catalogue level above categories (e.g. sports, or "Men/Women/Home") — `catalog.departmentLabel` names it | — |
| `targetAudience` | men/women/kids/unisex on products, navbar tabs, audience-scoped attributes | — |
| `technicalStats` | numeric per-category stats + radar chart | — |
| `compare` | product comparison | — |
| `collections` | campaign / collection pages | — |
| `articles` | blog / magazine, RSS | — |
| `secondHand` | used-product marketplace, health cards | — |
| `orderFlows` | multi-step product customisation (add-ons, services) | — |
| `athletes` | athlete pages | departments |
| `racketFinder` | guided racket questionnaire | departments, technicalStats |
| `reviews` | product reviews, photos, replies, review follow-up emails | — |
| `wishlist`, `tickets`, `contactForm`, `newsletter` | as named | — |
| `broadcasts` | admin → customer notifications, customer inbox | — |
| `push` | web push (VAPID keys) | — |
| `googleAuth` | Google sign-in (OAuth keys) | — |
| `discounts` | discount rules, flash sales, quantity tiers, coupon codes | — |
| `wallet` | customer wallet | — |
| `reviewCredit` | wallet credit for reviews | reviews, wallet |
| `coach` | coach codes and coach wallets | wallet, discounts |
| `installments` | cheque instalment payments + reminders | — |
| `orderEur` | manual EUR bookkeeping on orders | — |
| `warehouse` | barcode tracking in a separate warehouse DB | — |
| `aiAssistant` | AI admin data assistant (`AI_PROVIDER`, Gemini by default) | — |
| `aiProductDraft` | AI product drafts, product regeneration, prompt settings (Admin → محصولات) | departments |

The exchange-rate admin is not a switch: it exists exactly when
`commerce.pricing.mode` is `"exchange"`.

What each feature owns (paths, permission modules) is declared in
[`src/lib/features.js`](../src/lib/features.js). **Adding a feature** = an
entry there + a key in `store.config.js`; gate any UI with
`isFeatureEnabled("key")`.

## 4. Product data rules

```js
catalog: {
  departmentLabel, departmentLabelPlural,
  product: { fields, customFields, categoryRules },
},
```

The database requires only a product **name** (SKU and slug are generated).
Everything else is store policy, enforced by one module
([`src/lib/productRules.js`](../src/lib/productRules.js)) on every path:
admin create/edit forms (client and server), bulk import, storefront display,
search, filters, cart and checkout.

### Stages

| stage | when | what is checked |
|---|---|---|
| `draft` | saved but not published | rules with `required: "draft"` |
| `published` | visible in the storefront | + rules with `required: "published"` |
| `purchasable` | can be bought | + rules with `required: "purchasable"`, the purchase mode, the product's "for sale" switch, stock |

A product can be published but not purchasable (e.g. no price yet): it is
shown with "not available" and the cart and checkout refuse it.

### Field rules

```js
fields: {
  brand:    { required: "published", filterable: true, searchable: true },
  sku:      { public: false, searchable: true },     // internal: admin only
  mainImage:{ required: "published" },
  basePrice:{ required: "purchasable", min: 0 },
  color:    { use: false },                          // this store has no colour field
}
```

| prop | meaning | default |
|---|---|---|
| `use` | the field exists for this store | `true` |
| `required` | `false` \| `"draft"` \| `"published"` \| `"purchasable"` | `false` |
| `admin` | shown in the admin form | = `use` |
| `public` | sent to customers (internal fields are stripped server-side) | `true` (`stock`: `false`) |
| `filterable` | offered as a storefront filter (only if public) | `false` |
| `searchable` | matched by storefront search (only if public) | `false` |
| `min`, `max` | numbers | — |
| `minLength`, `maxLength`, `pattern`, `patternMessage` | text | — |
| `label` | label in admin and errors | — |

Built-in fields: `name, sku, category, brand, serie, limitedEdition, sport
(department), athlete, targetAudience, technicalStats, shortDescription,
longDescription, mainImage, gallery, basePrice, stock, color, tag, label`.
Feature-owned fields (brand, serie, …) disappear with their feature.

### Custom fields

```js
customFields: [
  { key: "warrantyMonths", label: "گارانتی (ماه)", type: "number", min: 0, max: 60, filterable: true },
  { key: "supplierCode", label: "کد تأمین‌کننده", type: "text", public: false, required: "published" },
  { key: "material", label: "جنس", type: "select", options: ["چرم", "پارچه"], searchable: true },
]
```

`type`: `text | textarea | number | boolean | select | date | url`, plus every
rule prop above. Values live in `product.customFields`; the admin forms render
inputs for them automatically, the product page lists public ones in the specs
table, filterable ones appear in listing filters. Removing a field from the
config hides it but never deletes stored values.

### Per-category rules

```js
categoryRules: {
  "books":      { fields: { brand: { use: false } },
                  customFields: [{ key: "isbn", label: "ISBN", type: "text", required: "draft" }] },
  "gift-cards": { fields: { mainImage: { required: false } }, purchase: "inquiry" },
}
```

Keyed by category slug; a rule applies to the category **and every category
below it**, the most specific one winning. `purchase` overrides the store's
purchase mode for those products.

### Admin-managed attributes

Categories also carry attributes the store owner manages without code (Admin →
دسته‌بندی‌ها): per attribute you choose required (before publishing),
filterable, searchable, visible to customers or internal, min/max/pattern, and
— with `targetAudience` — which audiences it applies to. Use config rules for
structure the developer owns, category attributes for data the merchant owns.

### Import

Admin → محصولات → ورود گروهی (or `POST /api/product/import`): an Excel/CSV
file (`name, sku, category, brand, basePrice, …, attr.<attribute>,
custom.<field>`) or JSON. Every row goes through the same validation as the
form; a dry run reports per row without writing.

## 5. Commerce rules

```js
commerce: {
  currency: { label: "تومان", locale: "fa-IR" },
  pricing:  { mode: "direct", roundTo: 1 },
  purchase: { mode: "cart", inquiryText: "…" },
  inventory:{ mode: "none" },
  delivery: { mode: "shipping" },
  paymentMethods: ["BANK_RECEIPT"],
}
```

| setting | values | effect |
|---|---|---|
| `pricing.mode` | `direct` | stored prices are the selling prices |
| | `exchange` | prices are stored in a foreign currency and multiplied by the rate set in Admin → مدیریت مالی |
| `pricing.roundTo` | number | final prices rounded down to a multiple of it |
| `purchase.mode` | `cart` | normal cart + checkout |
| | `inquiry` | no cart; products show `inquiryText` and a contact button (WhatsApp, phone, or the contact page) |
| | `catalog` | showcase only |
| `inventory.mode` | `none` | stock not tracked |
| | `stock` | stock per variant (or per product without variants); checkout reserves it atomically, cancelling or deleting an order returns it, sold-out options can't be added. Empty stock = "not tracked" for that item |
| `delivery.mode` | `shipping` | address required at checkout |
| | `pickup`, `digital` | no address step, no address stored |
| `paymentMethods` | `BANK_RECEIPT`, `INSTALLMENT` | offered at checkout (`INSTALLMENT` also needs the feature) |

## 6. Beyond configuration

Configuration gets a store running in a different shape; a client's look and
behaviour are yours to change in their copy:

- **Page layouts**: `src/app/(Site)/…` (routes) and `src/components/templates/…`
  (product page, listings). Home sections are plain components — add one to
  the `SECTIONS` table in `src/app/(Site)/page.js` and name it in `home.sections`.
- **Header / footer**: `src/components/features/navbar/`, `…/footer/Footer.js`.
- **Business logic**: prices `services/priceEngine.js`, checkout
  `src/app/api/checkout/route.js`, stock `services/inventory.service.js`,
  product writes `services/productWrite.service.js`.

Keep `store.config.js` as the home of per-client choices; that keeps each copy
easy to compare with the base when you port improvements between clients.

## 7. Starting a new client

1. Copy the base into a new repository (fresh history).
2. `.env` (committed in this store's private repository); a MongoDB replica set (Atlas, or `npm run dev:db`).
3. Edit `store.config.js`; replace `public/brand/*`.
4. `npm run seed -- --phone … --password …` for the first admin
   (`--demo` adds a sample catalogue).
5. `npm run build`, `npm test`, and `npm run smoke -- --phone … --password …`
   against the running store to confirm the configuration behaves as intended.
6. Deploy (Vercel: set the env vars incl. `CRON_SECRET`).
