/**
 * A post-login destination is only ever a path on this site. Anything else —
 * "https://evil.example", "//evil.example", "/\evil.example" — becomes "/",
 * so a crafted ?callbackUrl= cannot send a freshly logged-in user elsewhere.
 */
export function safeRedirectPath(value) {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/";
}
