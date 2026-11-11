/**
 * <head> content shared by the three root layouts (storefront, customer
 * dashboard, admin): the theme from store.config.js as CSS variables, the font
 * stylesheet and the browser theme colour.
 *
 * globals.css declares the same variables as fallbacks; this inline block wins
 * because it comes later with the same selector.
 */
import storeConfig from "base/store.config";

/** "#2563eb" → "221 83% 53%" (the shadcn-style triplet some components read as hsl(var(--primary))). */
function hslTriplet(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

export function themeCss(theme = storeConfig.theme) {
  const c = theme.colors;
  const vars = {
    "--color-primary": c.primary,
    "--color-primary-dark": c.primaryDark,
    "--color-secondary": c.secondary,
    "--color-dark": c.dark,
    "--color-text": c.text,
    "--color-background": c.background,
    "--color-border": c.border,
    "--color-surface": c.surface,
    "--color-surface-soft": c.surfaceSoft,
    "--color-muted": c.muted,
    "--primary": hslTriplet(c.primary),
    "--radius": theme.radius,
    "--font-sans": theme.fontFamily,
  };
  const body = Object.entries(vars)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  // A zero radius means "no rounded corner anywhere": components also carry
  // hard-coded radii (rounded-xl, rounded-full, inline styles), so the store-wide
  // rule is the only way to reach them all. The admin panel keeps its own theme;
  // spinners stay round because a square one does not read as loading.
  const square = parseFloat(theme.radius) === 0
    ? `body:not(:has(.admin-scope)) :not(.animate-spin),body:not(:has(.admin-scope)) ::before,body:not(:has(.admin-scope)) ::after{border-radius:0!important}`
    : "";
  return `:root,.site-colors{${body}}${square}`;
}

export default function StoreHead() {
  const { theme } = storeConfig;
  return (
    <>
      {theme.fontStylesheet ? <link rel="stylesheet" href={theme.fontStylesheet} /> : null}
      <meta name="theme-color" content={theme.browserThemeColor || theme.colors.background} />
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
    </>
  );
}
