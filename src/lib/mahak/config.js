/**
 * Mahak accounting integration — settings.
 *
 * Which accounts exist and how their data is read lives in store.config.js →
 * integrations.mahak (plain data). The credentials of each account live in the
 * environment, read here and nowhere else:
 *
 *   MAHAK_<KEY>_USERNAME / _PASSWORD / _DATABASE_ID / _PACKAGE_NO
 *
 * (<KEY> = the account key upper-cased: "shoes" → MAHAK_SHOES_USERNAME.)
 * An account without credentials is simply "not configured": every sync skips
 * it, nothing throws.
 */
import storeConfig from "../../../store.config.js";

const cfg = storeConfig.integrations?.mahak || {};

export const MAHAK = {
  accounts: Array.isArray(cfg.accounts) ? cfg.accounts : [],
  // 0 = each item's own default sell level (ProductDetail.defaultSellPriceLevel)
  priceLevel: Number(cfg.priceLevel) || 0,
  // Mahak amount ÷ divisor = site amount (10 when Mahak keeps Rial and the site Toman)
  priceDivisor: Number(cfg.priceDivisor) || 1,
  // The API has no purchase-price field; a store that keeps it in a price level names it here.
  buyPriceLevel: Number(cfg.buyPriceLevel) || 0,
  // "auto" | "storeAssets" | "visitorProducts"
  stockSource: cfg.stockSource || "auto",
  // Limit warehouse stock to these Mahak storeIds, per account key ({} = every warehouse)
  storeIds: cfg.storeIds || {},
  // After an invoice is posted, keep its quantities off the site stock this long
  // (Mahak lowers its own stock only once the invoice is accepted in the software).
  reservationHoldMinutes: Number(cfg.reservationHoldMinutes ?? 180),
  // 201 = sales invoice, 299 = pre-invoice
  orderType: Number(cfg.orderType) || 201,
};

export const mahakAccountKeys = () => MAHAK.accounts.map((a) => a.key);

export const mahakAccountLabel = (key) => MAHAK.accounts.find((a) => a.key === key)?.label || key;

/** @returns {{userName,password,databaseId,packageNo}|null} null = not configured */
export function accountCredentials(key, env = process.env) {
  const p = `MAHAK_${String(key).toUpperCase()}_`;
  const userName = env[`${p}USERNAME`];
  const password = env[`${p}PASSWORD`];
  const databaseId = Number(env[`${p}DATABASE_ID`]);
  if (!userName || !password || !Number.isFinite(databaseId) || !databaseId) return null;
  return { userName, password, databaseId, packageNo: env[`${p}PACKAGE_NO`] || "" };
}
