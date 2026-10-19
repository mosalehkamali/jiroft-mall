/**
 * tests/aliasHooks.mjs
 *
 * حلِ اسمِ مستعارِ `base/*` و `@/*` (که در jsconfig تعریف شده‌اند) برای
 * `node --test`. بدون این، هیچ تستی نمی‌تواند مستقیم services/ یا models/ را
 * ایمپورت کند، چون خودشان با همین اسم‌های مستعار به هم ارجاع می‌دهند.
 */
import { pathToFileURL } from "node:url";

const ROOT = pathToFileURL(`${process.cwd()}/`).href;
const withExtension = (url) => (/\.(js|jsx|mjs|cjs|json)$/i.test(url) ? url : `${url}.js`);

// STORE_CONFIG_FIXTURE=tests/fixtures/x.js: every import of the root
// store.config.js resolves to that file instead (except from the fixture itself).
const FIXTURE = process.env.STORE_CONFIG_FIXTURE ? new URL(process.env.STORE_CONFIG_FIXTURE, ROOT).href : null;
const CONFIG = `${ROOT}store.config.js`;

async function aliased(specifier, context, next) {
  if (specifier.startsWith("base/")) return next(withExtension(ROOT + specifier.slice(5)), context);
  if (specifier.startsWith("@/")) return next(withExtension(`${ROOT}src/${specifier.slice(2)}`), context);
  return next(specifier, context);
}

export async function resolve(specifier, context, next) {
  const result = await aliased(specifier, context, next);
  if (FIXTURE && result.url === CONFIG && context.parentURL !== FIXTURE) return { ...result, url: FIXTURE };
  return result;
}
