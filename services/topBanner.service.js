import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import { TOP_BANNER_KEY, validateTopBanner } from "@/lib/topBanner";

const readActiveTopBanner = unstable_cache(async () => {
  await connectToDB();
  const setting = await SiteSetting.findOne({ key: TOP_BANNER_KEY }, "value").lean();
  const banner = setting?.value;
  if (!banner?.enabled || validateTopBanner(banner)) return null;
  return { image: banner.image, mobileImage: banner.mobileImage || "", href: banner.href };
}, [TOP_BANNER_KEY], { tags: [TOP_BANNER_KEY], revalidate: 3600 });

export async function getActiveTopBanner() {
  try {
    return await readActiveTopBanner();
  } catch (error) {
    console.error("Could not load the storefront top banner", error);
    return null;
  }
}
