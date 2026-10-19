/**
 * Test fixture: the base config with EVERY feature on, exchange-rate pricing and
 * all payment methods — the setup the original (pre-starter) test suite was
 * written against. scripts/run-tests.mjs points `store.config` here (via
 * tests/aliasHooks.mjs) for every test except those listed as default-config
 * tests, which check the shipped store.config.js itself.
 */
import base from "../../store.config.js";

const config = {
  ...base,
  // every switch the config declares (features.test.mjs keeps that list complete)
  features: Object.fromEntries(Object.keys(base.features).map((key) => [key, true])),
  commerce: {
    ...base.commerce,
    pricing: { mode: "exchange", roundTo: 1000 },
    paymentMethods: ["BANK_RECEIPT", "INSTALLMENT"],
  },
};

export default config;
