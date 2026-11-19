import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import "base/models/registerModels";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import {
  normalizeSiteFooter,
  validateSiteFooter,
  SITE_FOOTER_CACHE_TAG,
  SITE_FOOTER_SETTING_KEY,
} from "@/lib/siteFooter";

export async function GET() {
  const { denied } = await requireAdminPermission("siteFooter.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({ key: SITE_FOOTER_SETTING_KEY }).lean();
    return NextResponse.json({ footer: normalizeSiteFooter(setting?.value), saved: Boolean(setting) });
  } catch (err) {
    console.error("site-footer GET error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req) {
  const { denied } = await requireAdminPermission("siteFooter.edit");
  if (denied) return denied;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }

  const { footer, errors } = validateSiteFooter(body?.footer);
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

  try {
    await connectToDB();
    await SiteSetting.findOneAndUpdate(
      { key: SITE_FOOTER_SETTING_KEY },
      { value: footer },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Every storefront page renders the footer.
    revalidateContent([SITE_FOOTER_CACHE_TAG]);
    try {
      revalidatePath("/", "layout");
    } catch {
      // در محیط‌هایی که revalidatePath در دسترس نیست بی‌صدا رد شو
    }
    await purgeSportPagesCdn();

    return NextResponse.json({ footer });
  } catch (err) {
    console.error("site-footer PUT error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
