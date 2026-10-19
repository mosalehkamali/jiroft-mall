import { isFeatureEnabled } from "./features.js";

/**
 * Storefront URL of a taxonomy page from its slugs, skipping empty levels:
 * catalogPath(sport?.slug, category.slug, brand?.slug).
 *
 * A store without departments has no first level, so "/[sport]/[category]"
 * becomes "/[category]". No level at all is the full catalogue.
 */
export function catalogPath(...slugs) {
  const segs = slugs.filter(Boolean).map(String);
  return segs.length ? `/${segs.join("/")}` : "/products";
}

/** A category's page (optionally narrowed by more slugs, e.g. a brand). */
export function categoryPath(category, ...more) {
  const department = isFeatureEnabled("departments") ? category?.sport?.slug : null;
  return catalogPath(department, category?.slug, ...more);
}
