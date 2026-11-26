"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import { EMPTY_TOP_BANNER, TOP_BANNER_KEY, validateTopBanner } from "@/lib/topBanner";

export default function TopBannerPage() {
  const { can } = useAdminPermissions();
  const [form, setForm] = useState(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const uploading = uploadingMain || uploadingMobile;
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const editable = can("homeBanners.edit");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/site-settings?key=${TOP_BANNER_KEY}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const { value } = await response.json();
        if (!controller.signal.aborted) setForm({ ...EMPTY_TOP_BANNER, ...value });
      } catch {
        if (!controller.signal.aborted) setNotice("دریافت تنظیمات بنر ناموفق بود.");
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setNotice("");
  }

  async function save(event) {
    event.preventDefault();
    if (!editable || saving || uploading) return;
    const value = { ...form, href: form.href.trim() };
    const error = validateTopBanner(value);
    if (error) { setNotice(error); return; }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: TOP_BANNER_KEY, value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "ذخیره تنظیمات ناموفق بود.");
      setForm({ ...EMPTY_TOP_BANNER, ...data.value });
      setNotice("تنظیمات بنر ذخیره شد.");
    } catch (err) {
      setNotice(err instanceof TypeError ? "ارتباط با سرور برقرار نشد." : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section dir="rtl" className="max-w-2xl space-y-4">
      <Link href="/p-admin/admin-pages?tab=home" className="text-sm underline">بازگشت به صفحات سایت</Link>
      <h1 className="text-xl font-bold">بنر بالای نوبار</h1>
      {form ? (
        <form onSubmit={save} className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card)] p-5">
          <fieldset disabled={!editable || saving} className="space-y-5">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={form.enabled} onChange={e => change("enabled", e.target.checked)} />
              نمایش بنر در فروشگاه
            </label>
            <p className="text-sm">تصویر یا GIF متحرک تا ۵ مگابایت. تصویر کامل و بدون برش نمایش داده می‌شود و ارتفاعش از نسبت خودِ تصویر می‌آید.</p>
            <ImageUpload label="تصویر بنر (دسکتاپ و تبلت) — پیشنهاد: ۱۹۲۰×۹۰ پیکسل" value={form.image} folder="store-top-banner"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onChange={image => change("image", image)} onUploadingChange={setUploadingMain} />
            <ImageUpload label="تصویر بنر موبایل (اختیاری) — پیشنهاد: ۱۰۸۰×۱۸۰ پیکسل" value={form.mobileImage} folder="store-top-banner"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onChange={image => change("mobileImage", image)} onUploadingChange={setUploadingMobile} />
            <p className="text-xs text-[var(--admin-muted,#6b7280)]">تصویر موبایل روی صفحه‌های کوچک‌تر از ۷۶۸ پیکسل نمایش داده می‌شود؛ اگر خالی باشد همان تصویر دسکتاپ نشان داده می‌شود.</p>
            <label className="block space-y-2">
              <span>لینک مقصد</span>
              <input dir="ltr" type="text" required={form.enabled} maxLength={2000} placeholder="/products"
                className="w-full rounded-lg border p-3 text-left" value={form.href} onChange={e => change("href", e.target.value)} />
            </label>
            {editable && <button type="submit" disabled={uploading || saving}
              className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-white disabled:opacity-50">
              {saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}
            </button>}
          </fieldset>
        </form>
      ) : notice ? (
        <button type="button" className="underline" onClick={() => { setNotice(""); setAttempt(attempt + 1); }}>تلاش دوباره</button>
      ) : <p>در حال دریافت تنظیمات…</p>}
      <p role="status" className="text-sm">{notice}</p>
    </section>
  );
}
