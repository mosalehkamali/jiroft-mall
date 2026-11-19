/**
 * tests/vmDeps.mjs — real implementations of the pure config modules for the
 * tests that load a route into a vm and stub its imports by hand. Routes read
 * store.config.js (and the feature/commerce/product-rule helpers built on it);
 * stubbing those per test would only duplicate the config. Services with side
 * effects get inert defaults here and are still stubbed by the test when it
 * cares about them.
 */
import * as features from "../src/lib/features.js";
import * as commerce from "../src/lib/commerce.js";
import * as productRules from "../src/lib/productRules.js";
import * as catalogPath from "../src/lib/catalogPath.js";
import * as currency from "../src/lib/currency.js";
import storeConfig from "base/store.config";

class InventoryError extends Error {}

export const PURE_DEPS = {
  "base/store.config": { default: storeConfig },
  "@/lib/features": features,
  "@/lib/commerce": commerce,
  "@/lib/productRules": productRules,
  "@/lib/catalogPath": catalogPath,
  "@/lib/currency": currency,
  "base/services/inventory.service": {
    InventoryError,
    inventoryTracked: () => false,
    reserveOrderStock: async () => false,
    releaseOrderStock: async () => {},
  },
  // Mahak accounting: off in the fixture config, so both are no-ops there
  "base/services/mahak/sync.service": {
    checkMahakStock: async () => [],
    shortageMessage: () => "",
    afterMahakProductEdit: async () => {},
  },
  "base/services/mahak/order.service": { queueMahakInvoice: async () => {} },
  "base/services/onlinePayment.service": { expireUnpaidOnlineOrders: async () => 0, startOnlinePayment: async () => ({ url: "", payment: null }) },
  "base/services/payments/zarinpal": { zarinpalConfigured: () => false },
  "base/services/productRules.service": {
    rulesForCategory: async () => productRules.resolveProductRules([]),
    rulesResolver: async () => () => productRules.resolveProductRules([]),
  },
};
