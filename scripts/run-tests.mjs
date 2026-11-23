/**
 * scripts/run-tests.mjs — `npm test`: every tests/*.test.mjs in its own
 * process (tests start their own in-memory MongoDB and register their own
 * module hooks, so they must not share one), with tests/aliasHooks.mjs for the
 * `base/` and `@/` aliases.
 *
 * Config: DEFAULT_CONFIG_TESTS check the shipped store.config.js; every other
 * test runs against tests/fixtures/store.config.full.js (all features on,
 * exchange pricing) — the setup those tests were written for.
 *
 *   npm test                      all tests
 *   npm test -- variant product   only files whose name contains a word
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_TESTS = new Set(["features.test.mjs", "productRules.test.mjs", "mahak.test.mjs", "onlinePayment.test.mjs", "rozPayment.test.mjs"]);
const filters = process.argv.slice(2);
const files = fs
  .readdirSync("tests")
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => !filters.length || filters.some((w) => f.includes(w)))
  .sort();

const failed = [];
for (const file of files) {
  const full = path.join("tests", file);
  const args = ["--test", "--experimental-vm-modules", "--test-timeout=180000", "--experimental-loader", "./tests/aliasHooks.mjs", full];
  const env = { ...process.env, NODE_NO_WARNINGS: "1" };
  if (!DEFAULT_CONFIG_TESTS.has(file)) env.STORE_CONFIG_FIXTURE = "tests/fixtures/store.config.full.js";
  const run = spawnSync(process.execPath, args, { encoding: "utf8", env });
  const out = `${run.stdout}${run.stderr}`;
  const pass = Number(out.match(/^ℹ pass (\d+)/m)?.[1] || 0);
  const fail = Number(out.match(/^ℹ fail (\d+)/m)?.[1] || 0);
  const ok = run.status === 0;
  console.log(`${ok ? "✓" : "✗"} ${file.padEnd(44)} ${pass} passed${fail ? `, ${fail} failed` : ""}`);
  if (!ok) failed.push({ file, out });
}

for (const { file, out } of failed) {
  const lines = out.split("\n").filter((l) => /✖|Error|assert|expected|actual|at .*tests/.test(l));
  console.log(`\n──── ${file}\n${lines.slice(0, 25).join("\n")}`);
}
console.log(`\n${files.length - failed.length}/${files.length} test files passed`);
process.exit(failed.length ? 1 : 0);
