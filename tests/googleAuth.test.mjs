// node --test tests/googleAuth.test.mjs
//
// Google login: the start route ties the request to the browser with `state`,
// the callback refuses anything without it (before ever talking to Google),
// and no login — Google or phone — can redirect off the site.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { safeRedirectPath } from "../src/lib/safeRedirect.js";

register("./productCreationHooks.mjs", import.meta.url); // aliases + next/* resolution
// utils/auth.js uses a named import from CommonJS jsonwebtoken (fine in Next's bundle, not in plain Node)
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function load(url, context, next) {
      const result = await next(url, context);
      if (!url.endsWith("/utils/auth.js")) return result;
      return { ...result, source: String(result.source).replace(
        'import { sign, verify } from "jsonwebtoken";',
        'import jwt from "jsonwebtoken"; const { sign, verify } = jwt;') };
    }`),
);

process.env.MONGODB_URI ||= "mongodb://127.0.0.1:1/unused"; // configs/db reads it on import; never connected here
process.env.NEXT_PUBLIC_BASE_URL = "https://shop.test";

test("post-login destinations stay on the site", () => {
  for (const ok of ["/", "/p-user/orders", "/products?x=1"]) assert.equal(safeRedirectPath(ok), ok);
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeRedirectPath(bad), "/", String(bad));
  }
});

test("without keys the button explains it is unavailable instead of opening a broken Google page", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const { GET } = await import("../src/app/api/auth/google/route.js");
  const res = await GET(new Request("https://shop.test/api/auth/google"));
  assert.equal(res.headers.get("location"), "https://shop.test/login-register?error=oauth_unavailable");
});

test("start: Google gets our client id, callback URL and a random state, which is also set as a cookie", async () => {
  process.env.GOOGLE_CLIENT_ID = "123-abc.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  const { GET } = await import("../src/app/api/auth/google/route.js");
  const res = await GET(new Request("https://shop.test/api/auth/google"));
  const url = new URL(res.headers.get("location"));
  assert.equal(url.host, "accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "123-abc.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://shop.test/api/auth/google/callback");
  const state = url.searchParams.get("state");
  assert.ok(state && state.length >= 32);
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`oauth_state=${state}`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);

  const again = new URL((await GET(new Request("https://shop.test/api/auth/google"))).headers.get("location"));
  assert.notEqual(again.searchParams.get("state"), state, "a new state every time");
});

test("callback: a missing or foreign state is refused before any call to Google", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("must not contact Google");
  const { GET } = await import("../src/app/api/auth/google/callback/route.js");
  const { NextRequest } = await import("next/server.js");
  const call = (qs, cookie) =>
    GET(new NextRequest(`https://shop.test/api/auth/google/callback?${qs}`, { headers: cookie ? { cookie } : {} }));
  const failed = "https://shop.test/login-register?error=oauth_failed";
  try {
    assert.equal((await call("code=abc&state=s1")).headers.get("location"), failed, "no state cookie");
    assert.equal((await call("code=abc&state=s1", "oauth_state=s2")).headers.get("location"), failed, "different state");
    assert.equal((await call("code=abc", "oauth_state=s2")).headers.get("location"), failed, "no state in the URL");
    assert.equal((await call("error=access_denied&state=s2", "oauth_state=s2")).headers.get("location"), failed, "user cancelled at Google");
  } finally {
    globalThis.fetch = realFetch;
  }
});
