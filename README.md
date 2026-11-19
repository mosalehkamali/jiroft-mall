# Store Base

A reusable, full-featured e-commerce starter (Next.js 16 + MongoDB, Persian/RTL
first). Copy it once per client; each copy gets its own branding, features,
product-data rules, commerce rules, database and services.

Everything that makes a store *that* store lives in **one file:
[`store.config.js`](store.config.js)**. The full reference is
[docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).

| You want to… | Edit |
|---|---|
| change name, logo, colours, fonts, contact details, links | `brand`, `theme`, `navigation` in `store.config.js` + files in `public/brand/` |
| choose home page sections and their order | `home.sections` |
| turn capabilities on/off (brands, blog, reviews, wallet, instalments, sports departments, …) | `features` |
| decide which product fields exist, are required (draft / published / purchasable), are shown to customers, filterable, searchable; add custom fields; per-category rules | `catalog.product` |
| set pricing (direct or exchange-rate), purchase mode (cart / inquiry / catalogue), stock tracking, delivery (shipping / pickup / digital), payment methods | `commerce` |
| change layouts or design beyond configuration | the code — it's your copy |

## Start a new client store

```bash
# 1. copy the base into a new project with its own history
git clone <this repo> client-store && cd client-store
rm -rf .git && git init -b main            # (Windows: Remove-Item -Recurse -Force .git)
npm install

# 2. configure
# .env is committed in this store's (private) repo — edit MONGODB_URI and the keys there
# edit store.config.js, replace public/brand/*

# 3. a database: MongoDB Atlas, or a throwaway local one
npm run dev:db                              # prints a MONGODB_URI — keep it running

# 4. first admin (+ optional demo catalogue)
npm run seed -- --phone 09120000000 --password 'change-me' --name "مدیر" --demo

# 5. run
npm run dev                                 # http://localhost:3000, admin at /p-admin
```

Requirements: Node 20+, a MongoDB **replica set** (product writes use
transactions; Atlas and `npm run dev:db` both are one).

## Checks

```bash
npm run build                               # production build
npm run test:store-rules                    # feature registry + product rules (fast, no DB)
npm test                                    # full suite (spins up in-memory MongoDB)
npm run smoke -- --phone … --password … --base http://localhost:3000
                                            # end-to-end against a running store (writes test data)
```

## What's inside

Storefront (catalogue with optional departments, brands, series, filters,
search, compare, collections, blog, CMS pages), customer dashboard (orders,
payments, addresses, wishlist, tickets, wallet, instalments), and an admin
panel with role-based permissions and an audit log: products & variants,
categories with admin-defined attributes, bulk import, orders and payment
review, discounts and coupons, banners and home sliders, a block-based page
and article editor, analytics, users and admins.

Every optional part is a **feature** in `store.config.js`. A disabled feature
is closed everywhere — pages and APIs answer 404, its admin pages and
permissions disappear (even for full-access admins), its notifications, crons
and workers do nothing — and its data is never deleted: switching it back on
restores it.

## Deployment

Built for Vercel (see `vercel.json` for the cron jobs, which need
`CRON_SECRET`). Any Node host works: `npm run build && npm start`, plus a
scheduler calling `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`.

Developer notes on the architecture: [CLAUDE.md](CLAUDE.md).
