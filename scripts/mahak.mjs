/**
 * scripts/mahak.mjs — Mahak accounting from the command line.
 *
 *   npm run mahak:inspect   read-only: log in to every configured account and
 *                           print a few raw rows of each entity (nothing is
 *                           written, here or in Mahak). Run this first: it shows
 *                           the visitorId, how `properties` (size/colour) looks
 *                           and whether prices are Rial or Toman.
 *   npm run mahak:sync      the full sync without the web time limit — use it
 *                           for the first import of a large catalogue.
 */
import { MAHAK, accountCredentials } from "../src/lib/mahak/config.js";
import { ENTITIES, pullAll } from "../src/lib/mahak/client.js";

const mode = process.argv[2];

if (mode === "inspect") {
  for (const { key, label } of MAHAK.accounts) {
    console.log(`\n══ ${label} (${key}) ══`);
    if (!accountCredentials(key)) {
      console.log(`تنظیم نشده: MAHAK_${key.toUpperCase()}_USERNAME / _PASSWORD / _DATABASE_ID / _PACKAGE_NO`);
      continue;
    }
    try {
      const { rows, visitorId } = await pullAll(key, Object.keys(ENTITIES), {}, { pageSize: 5, maxPages: 1 });
      console.log("visitorId:", visitorId);
      for (const [entity, list] of Object.entries(rows)) {
        console.log(`\n── ${entity}: ${list.length} ردیف در صفحه‌ی اول`);
        for (const row of list.slice(0, 2)) console.log(JSON.stringify(row, null, 2));
      }
    } catch (err) {
      console.log("خطا:", err.message);
    }
  }
} else if (mode === "sync") {
  const { default: connectToDB } = await import("../configs/db.js");
  const { default: mongoose } = await import("mongoose");
  await connectToDB();
  const { runMahakSync } = await import("../services/mahak/sync.service.js");
  const { retryMahakInvoices } = await import("../services/mahak/order.service.js");
  const result = await runMahakSync({ budgetMs: 24 * 3600 * 1000 });
  console.log(JSON.stringify(result, null, 2));
  console.log("invoices:", await retryMahakInvoices());
  await mongoose.disconnect();
} else {
  console.log("usage: node scripts/mahak.mjs inspect | sync");
  process.exit(1);
}
