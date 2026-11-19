import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import { defaultSiteFooter, normalizeSiteFooter, SITE_FOOTER_CACHE_TAG, SITE_FOOTER_SETTING_KEY } from "@/lib/siteFooter";

const readFooter = unstable_cache(
  async () => {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key: SITE_FOOTER_SETTING_KEY }).lean();
    return normalizeSiteFooter(setting?.value);
  },
  ["site-footer"],
  { revalidate: 3600, tags: [SITE_FOOTER_CACHE_TAG] }
);

// The footer is on every page: a database hiccup must not take the storefront down.
export async function getSiteFooter() {
  try {
    return await readFooter();
  } catch (err) {
    console.error("site footer read failed:", err);
    return defaultSiteFooter();
  }
}
