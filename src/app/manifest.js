import storeConfig from "base/store.config";

// /manifest.webmanifest — generated from store.config.js
export default function manifest() {
  const { brand, theme } = storeConfig;
  return {
    name: brand.name,
    short_name: brand.nameEn || brand.name,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    dir: brand.dir,
    lang: brand.lang,
    background_color: theme.colors.background,
    theme_color: theme.browserThemeColor || theme.colors.background,
    icons: [{ src: brand.favicon, sizes: "any", type: brand.favicon.endsWith(".svg") ? "image/svg+xml" : "image/png" }],
  };
}
