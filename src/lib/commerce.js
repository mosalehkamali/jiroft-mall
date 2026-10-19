/**
 * Commerce rules from store.config.js that both the checkout UI and the
 * checkout API need (client-safe: no server imports).
 */
import storeConfig from "base/store.config";
import { isFeatureEnabled } from "./features.js";

const commerce = storeConfig.commerce || {};

/** Only a shipping store asks for (and stores) a delivery address. */
export const NEEDS_ADDRESS = (commerce.delivery?.mode || "shipping") === "shipping";

/** "cart" | "inquiry" | "catalog" — anything but "cart" has no checkout at all. */
export const PURCHASE_MODE = commerce.purchase?.mode || "cart";

/** Payment methods offered at checkout, minus those whose feature is off. */
export function checkoutPaymentMethods() {
  return (commerce.paymentMethods || ["BANK_RECEIPT"]).filter(
    (m) => m !== "INSTALLMENT" || isFeatureEnabled("installments"),
  );
}
