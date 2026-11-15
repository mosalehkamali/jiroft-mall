/**
 * HTTP client for the Mahak sync API (Swagger: /API/v3, methods LoginV2,
 * GetAllDataV2, SaveAllDataV2). One session (token + visitorId) per account.
 *
 * What the spec leaves open, and how this client stays correct either way:
 *  - token lifetime is not documented → a call that fails on a cached token
 *    logs in again once and retries;
 *  - `pageSize` has no documented page cursor → pullAll() keeps asking "rows
 *    newer than the largest rowVersion I have" until nothing new arrives. That
 *    is right whether the server pages or returns everything at once.
 */
import { accountCredentials } from "./config.js";

const baseUrl = () => (process.env.MAHAK_BASE_URL || "https://mahakacc.mahaksoft.com/API/v3").replace(/\/$/, "");

// entity (array name in CommitDataModel) → its RowVersion request field and id field
export const ENTITIES = {
  products: { from: "fromProductVersion", id: "productId" },
  productDetails: { from: "fromProductDetailVersion", id: "productDetailId" },
  productCategories: { from: "fromProductCategoryVersion", id: "productCategoryId" },
  visitorProducts: { from: "fromVisitorProductVersion", id: "visitorProductId" },
  productDetailStoreAssets: { from: "fromProductDetailStoreAssetVersion", id: "productDetailStoreAssetId" },
};
export const STOCK_ENTITIES = ["visitorProducts", "productDetailStoreAssets"];

export class MahakError extends Error {
  constructor(message, { status = 0, code = 0 } = {}) {
    super(message);
    this.name = "MahakError";
    this.status = status;
    this.code = code;
  }
}

// survives hot reload and is shared by every route in one server instance
const sessions = (globalThis.__mahakSessions ||= new Map());

async function post(path, body, { token, timeoutMs = 30000 } = {}) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    throw new MahakError(`ارتباط با محک برقرار نشد (${err?.name === "TimeoutError" ? "پایان مهلت" : err?.message || "خطای شبکه"})`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok || !json || json.result === false) {
    throw new MahakError(json?.message || `پاسخ نامعتبر از محک (HTTP ${res.status})`, { status: res.status, code: json?.code });
  }
  return json.data;
}

export async function login(key, { force = false } = {}) {
  if (!force && sessions.has(key)) return sessions.get(key);
  const cred = accountCredentials(key);
  if (!cred) throw new MahakError(`اطلاعات اتصال حساب محک «${key}» تنظیم نشده است`);
  const data = await post("/Sync/LoginV2", { ...cred, language: "fa", appId: "store-site", clientVersion: "1" });
  if (!data?.userToken) throw new MahakError(data?.errorMessage || "ورود به محک ناموفق بود", { code: data?.errorCode });
  const session = { token: data.userToken, visitorId: data.visitorId, databaseId: data.databaseId };
  sessions.set(key, session);
  return session;
}

async function authed(key, path, makeBody, opts) {
  const cached = sessions.has(key);
  let session = await login(key);
  try {
    return { data: await post(path, makeBody(session), { ...opts, token: session.token }), session };
  } catch (err) {
    if (!cached) throw err;
    session = await login(key, { force: true }); // the cached token may have expired
    return { data: await post(path, makeBody(session), { ...opts, token: session.token }), session };
  }
}

const maxVersion = (rows, floor) => rows.reduce((m, r) => Math.max(m, Number(r?.rowVersion) || 0), floor);

/**
 * Rows of `entities` newer than `versions[entity]` (0 / missing = everything).
 * @returns {{ rows: Record<string, object[]>, versions: Record<string, number>, visitorId: number }}
 */
export async function pullAll(key, entities, versions = {}, { pageSize = 1000, maxPages = 300, timeoutMs } = {}) {
  const rows = Object.fromEntries(entities.map((e) => [e, []]));
  const next = Object.fromEntries(entities.map((e) => [e, Number(versions[e]) || 0]));
  let visitorId = null;
  for (let page = 0; page < maxPages; page++) {
    const { data, session } = await authed(
      key,
      "/Sync/GetAllDataV2",
      (s) => ({
        currentVisitorId: s.visitorId,
        pageSize,
        ...Object.fromEntries(entities.map((e) => [ENTITIES[e].from, next[e]])),
      }),
      { timeoutMs },
    );
    visitorId = session.visitorId;
    const objects = data?.objects || {};
    let advanced = false;
    for (const e of entities) {
      const got = Array.isArray(objects[e]) ? objects[e] : [];
      const top = maxVersion(got, next[e]);
      if (top > next[e]) {
        // a server that answers ">= version" repeats the last row; keep only the new ones
        rows[e].push(...got.filter((r) => (Number(r?.rowVersion) || 0) > next[e]));
        next[e] = top;
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  return { rows, versions: next, visitorId };
}

/** POST SaveAllDataV2. @returns the per-entity results object ({ orders: { results: [...] }, ... }) */
export async function saveAll(key, makeBody, opts) {
  const { data, session } = await authed(key, "/Sync/SaveAllDataV2", makeBody, opts);
  return { objects: data?.objects || {}, visitorId: session.visitorId };
}

export const __test = { sessions };
