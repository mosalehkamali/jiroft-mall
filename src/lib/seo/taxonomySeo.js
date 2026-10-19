import storeConfig from "base/store.config";
import { buildSerieNames, taxonomyEnglishName } from "./taxonomyNames.js";
import { catalogPath } from "../catalogPath.js";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

function label(entity) {
  return entity?.title || entity?.name || "";
}

export function buildTaxonomyMetadata(filters) {
  const sport = label(filters?.sport);
  const category = label(filters?.category);
  const brand = label(filters?.brand);
  const serie = label(filters?.serie);
  const limitedEdition = label(filters?.limitedEdition);

  if (limitedEdition && brand) {
    return {
      title: `خرید محصولات ${brand} ${limitedEdition}`,
      description:
        filters.limitedEdition.description ||
        `مشاهده و خرید محصولات کالکشن ${limitedEdition} از برند ${brand} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (serie && brand && sport) {
    const names = buildSerieNames(filters.brand, filters.serie);
    return {
      title: `محصولات ${names.localized} | خرید و قیمت انواع ${names.english || names.localized}`,
      description:
        filters.serie.description ||
        `مشاهده و خرید محصولات ${names.localized} برای ${sport} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (category && brand && sport) {
    return {
      title: `${category} ${sport} ${brand} | خرید و قیمت انواع ${taxonomyEnglishName(filters.brand) || brand}`,
      description:
        `مشاهده و خرید محصولات ${category} ${sport} از برند ${brand} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  // فروشگاهِ بدونِ دپارتمان: /[category]/[brand]
  if (category && brand) {
    return {
      title: `خرید ${category} ${brand}`,
      description:
        `مشاهده و خرید ${category} برند ${brand} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (brand && sport) {
    return {
      title: `خرید محصولات ${brand} برای ${sport}`,
      description:
        filters.brand.description ||
        `مشاهده و خرید محصولات برند ${brand} برای ${sport} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (category && sport) {
    return {
      title: `خرید ${category} ${sport}`,
      description:
        filters.category.description ||
        `مشاهده و خرید ${category} ${sport} از برندهای معتبر با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (brand) {
    return {
      title: `خرید محصولات برند ${brand}`,
      description:
        filters.brand.description ||
        `مشاهده و خرید محصولات برند ${brand} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  if (sport) {
    return {
      title: `خرید تجهیزات و لوازم ${sport}`,
      description:
        filters.sport.description ||
        `مشاهده و خرید تجهیزات تخصصی ${sport} از برندهای معتبر با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
    };
  }

  const active =
    filters?.limitedEdition ||
    filters?.serie ||
    filters?.brand ||
    filters?.category ||
    filters?.sport;

  return {
    title: `خرید ${label(active)}`,
    description:
      active?.description ||
      `مشاهده و خرید ${label(active)} با بررسی قیمت، مشخصات و موجودی در ${storeConfig.brand.name}.`,
  };
}

export function buildTaxonomyBreadcrumbs(filters) {
  const items = [{ name: "خانه", href: "/" }];
  const sport = filters?.sport;
  const category = filters?.category;
  const brand = filters?.brand;
  const serie = filters?.serie;
  const limitedEdition = filters?.limitedEdition;

  if (sport?.slug) {
    items.push({ name: label(sport), href: catalogPath(sport.slug) });
  }

  if (category?.slug) {
    items.push({
      name: label(category),
      href: catalogPath(sport?.slug, category.slug),
    });
  }

  if (brand?.slug) {
    items.push({ name: label(brand), href: catalogPath(sport?.slug, category?.slug, brand.slug) });
  }

  if (serie?.slug && brand?.slug) {
    items.push({
      name: label(serie),
      href: catalogPath(sport?.slug, brand.slug, serie.slug),
    });
  }

  if (limitedEdition?.slug && brand?.slug) {
    items.push({
      name: label(limitedEdition),
      href: `/${brand.slug}/${limitedEdition.slug}`,
    });
  }

  return items.map((item) => ({
    ...item,
    url: `${SITE_URL}${item.href === "/" ? "" : item.href}`,
  }));
}
