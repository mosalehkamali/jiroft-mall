import { Fragment } from "react";
import Hero from "@/components/features/hero/Hero";
import BannerSection from "@/components/banners/BannerSection";
import SportsGrid from "@/components/features/sportsGrid/SportsGrid";
import BestSellers from "@/components/features/bestSellers/BestSellers";
import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker";
import AmazingOffers from "@/components/features/amazingOffers/AmazingOffers";
import RolandGarros from "@/components/features/rolandGarros/RolandGarros";
import ComparisonBanner from "@/components/features/comparisonBanner/ComparisonBanner";
import MatchBanner from "@/components/features/matchBanner/MatchBanner";
import ShowcaseAthletes from "@/components/features/ShowcaseAthletes/ShowcaseAthletes";
import FeaturedArticles from "@/components/features/articles/FeaturedArticles";

import storeConfig from "base/store.config";
import { isFeatureEnabled } from "@/lib/features";
import { getHomeSliderProducts } from "base/services/product.service";
import connectToDB from "base/configs/db";
import SlideModel from "base/models/Slide";
import SportModel from "base/models/Sport";
import { getCachedRate } from "@/lib/Exchangerate";
import { getShowcaseAthletes } from "@/lib/athleteService";
import { getTickerBrands } from "base/services/brandTicker.service";
import { getHomeRolandGarrosBanner } from "base/services/homeRolandGarros.service";
import { getHomeFeaturedArticles } from "base/services/publicArticle.service";

// ISR: داده‌ها با تگ‌های unstable_cache (products/banners/sports/...) کش می‌شوند و
// بعد از هر تغییرِ ادمین از طریقِ revalidateContent باطل می‌شوند.
export const revalidate = 3600;

export const metadata = {
  // same segment as the root layout, so its title template does not apply here
  title: { absolute: `${storeConfig.home?.title || storeConfig.brand.tagline} | ${storeConfig.brand.name}` },
  description: storeConfig.brand.description,
  alternates: { canonical: "/" },
};

/**
 * Home sections, in store.config.js → home.sections order. A section belongs
 * to a feature; while that feature is off the section is skipped and its data
 * is never queried.
 */
const SECTIONS = {
  hero: { load: () => SlideModel.find({ isActive: true }).sort({ priority: 1 }).lean(), render: (d) => <Hero slides={d} /> },
  banners: { render: () => <BannerSection /> },
  departments: {
    feature: "departments",
    load: () => SportModel.find({}).sort({ order: 1 }).lean(),
    render: (d) => <SportsGrid categories={d} />,
  },
  compareAndFinder: {
    show: () => isFeatureEnabled("compare") || isFeatureEnabled("racketFinder"),
    render: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {isFeatureEnabled("compare") && <ComparisonBanner />}
        {isFeatureEnabled("racketFinder") && <MatchBanner />}
      </div>
    ),
  },
  bestSellers: { load: () => getHomeSliderProducts(), render: (d, rate) => <BestSellers products={d.bestSellers} rate={rate} /> },
  offers: { load: () => getHomeSliderProducts(), render: (d, rate) => <AmazingOffers products={d.offers} rate={rate} /> },
  featuredLimitedEdition: {
    feature: "limitedEditions",
    load: () => getHomeRolandGarrosBanner(),
    render: (d) => <RolandGarros content={d} />,
  },
  brands: { feature: "brands", load: () => getTickerBrands(), render: (d) => <BrandsTicker brands={d} /> },
  articles: { feature: "articles", load: () => getHomeFeaturedArticles(), render: (d) => <FeaturedArticles articles={d} /> },
  athletes: { feature: "athletes", load: () => getShowcaseAthletes(), render: (d) => <ShowcaseAthletes data={d} /> },
};

const enabledSections = (storeConfig.home?.sections || []).filter((key) => {
  const section = SECTIONS[key];
  if (!section) return false;
  if (section.feature && !isFeatureEnabled(section.feature)) return false;
  return section.show ? section.show() : true;
});

export default async function Home() {
  await connectToDB();

  // داده‌ی همه‌ی بخش‌های فعال موازی خوانده می‌شود (Parallel Fetching)
  const [rate, ...data] = await Promise.all([
    getCachedRate(),
    ...enabledSections.map((key) => (SECTIONS[key].load ? SECTIONS[key].load() : null)),
  ]);

  return (
    <>
      {enabledSections.map((key, i) => (
        <Fragment key={key}>
          {SECTIONS[key].render(JSON.parse(JSON.stringify(data[i] ?? null)), rate)}
        </Fragment>
      ))}
    </>
  );
}
