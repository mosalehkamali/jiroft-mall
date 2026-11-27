/**
 * A post-login destination is only ever a path on this site. Anything else —
 * "https://evil.example", "//evil.example", "/\evil.example" — becomes "/",
 * so a crafted ?callbackUrl= cannot send a freshly logged-in user elsewhere.
 */
export function safeRedirectPath(value) {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/";
}

/**
 * Absolute URL on the public site. Behind a reverse proxy (Chabokan) `request.url`
 * is the internal `http://localhost:3000`, so a redirect built from it sends the
 * browser to localhost — the configured site URL wins whenever it is set.
 */
export function siteUrl(path, request) {
  return new URL(path, process.env.NEXT_PUBLIC_BASE_URL || request.url);
}
