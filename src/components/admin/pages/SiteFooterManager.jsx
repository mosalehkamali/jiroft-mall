"use client";

// Admin → صفحات سایت → فوتر. Every text, link and social icon of the storefront footer.
import { useEffect, useState } from "react";
import { FiArrowDown, FiArrowUp, FiLoader, FiPlus, FiRefreshCcw, FiSave, FiTrash2 } from "react-icons/fi";
import AdminLoader from "@/components/admin/AdminLoader";
import ImageUpload from "@/components/admin/ImageUpload";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import { isFeatureEnabled } from "@/lib/features";
import { showToast } from "@/lib/toast";
import { showError } from "@/lib/swal";
import { defaultSiteFooter, FOOTER_LIMITS, SOCIAL_PLATFORMS } from "@/lib/siteFooter";

const API_URL = "/api/admin/site-footer";

const inputClass =
  "w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-800 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white disabled:opacity-60";
const iconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:pointer-events-none";
const addBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40";

const NEWSLETTER_FIELDS = [
  ["title", "عنوان خبرنامه"],
  ["subtitle", "توضیح خبرنامه"],
  ["placeholder", "متن داخل کادر ایمیل"],
  ["button", "متن دکمه"],
  ["subscribedTitle", "عنوان پس از عضویت"],
  ["subscribedSubtitle", "توضیح پس از عضویت"],
];

const move = (list, i, d) => {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
};

function Card({ title, hint, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "var(--color-border)" }}>
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-[11px] font-bold text-gray-400">{hint}</p> : null}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function MoveButtons({ i, length, onMove, onRemove, disabled }) {
  return (
    <>
      <button type="button" className={iconBtn} disabled={disabled || i === 0} onClick={() => onMove(i, -1)} aria-label="انتقال به بالا">
        <FiArrowUp size={14} />
      </button>
      <button type="button" className={iconBtn} disabled={disabled || i === length - 1} onClick={() => onMove(i, 1)} aria-label="انتقال به پایین">
        <FiArrowDown size={14} />
      </button>
      <button type="button" className={`${iconBtn} hover:!border-red-400 hover:!text-red-500`} disabled={disabled} onClick={() => onRemove(i)} aria-label="حذف">
        <FiTrash2 size={14} />
      </button>
    </>
  );
}

export default function SiteFooterManager() {
  const { can } = useAdminPermissions();
  const canEdit = can("siteFooter.edit");
  const ro = !canEdit;
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(API_URL)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در بارگذاری فوتر");
        if (cancelled) return;
        setForm(data.footer);
        setInitial(JSON.stringify(data.footer));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(true);
        showToast.error(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white py-16 text-center text-sm font-bold text-red-400">
        خطا در بارگذاری اطلاعات فوتر — صفحه را تازه‌سازی کنید
      </div>
    );
  }
  if (!form) return <AdminLoader />;

  const dirty = JSON.stringify(form) !== initial;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSection = (i, patch) => set({ sections: form.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setLink = (si, li, patch) =>
    setSection(si, { links: form.sections[si].links.map((l, j) => (j === li ? { ...l, ...patch } : l)) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ footer: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.errors || [data.error]).join("\n") || "خطا در ذخیره فوتر");
      setForm(data.footer);
      setInitial(JSON.stringify(data.footer));
      showToast.success("فوتر ذخیره شد");
    } catch (err) {
      showError("خطا", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-400">هر بخشی که خالی بماند در فوتر سایت نمایش داده نمی‌شود.</p>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            background: dirty ? "color-mix(in srgb, var(--color-secondary) 18%, transparent)" : "rgba(34,197,94,0.1)",
            color: dirty ? "#9a6700" : "#16a34a",
          }}
        >
          {dirty ? "تغییرات ذخیره‌نشده" : "ذخیره‌شده"}
        </span>
      </div>

      <Card title="معرفی فروشگاه" hint="لوگو و متن کوتاه زیر آن">
        <Field label="آدرس لوگو (روی زمینه‌ی تیره نمایش داده می‌شود)">
          <input dir="ltr" className={inputClass} value={form.logo} disabled={ro} onChange={(e) => set({ logo: e.target.value })} placeholder="/brand/logo-light.svg" />
        </Field>
        {canEdit ? (
          <ImageUpload key={form.logo} compact value={form.logo} folder="footer" onChange={(url) => set({ logo: url || "" })} onUploadingChange={setUploading} />
        ) : null}
        <Field label="متن معرفی">
          <textarea
            rows={4}
            className={`${inputClass} resize-y leading-7`}
            value={form.description}
            disabled={ro}
            maxLength={FOOTER_LIMITS.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
      </Card>

      <Card title="اطلاعات تماس" hint="به همین ترتیب در فوتر می‌آیند: شماره‌ها، آدرس، ایمیل">
        <div className="space-y-2">
          <span className="block text-xs font-bold text-gray-500">شماره تلفن</span>
          {form.phones.map((phone, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* ltr: شماره از چپ به راست تایپ و ذخیره می‌شود و برعکس نمی‌شود */}
              <input
                dir="ltr"
                inputMode="tel"
                className={`${inputClass} text-left`}
                value={phone}
                disabled={ro}
                placeholder="021 1234 5678"
                onChange={(e) => set({ phones: form.phones.map((p, j) => (j === i ? e.target.value : p)) })}
              />
              <MoveButtons
                i={i}
                length={form.phones.length}
                disabled={ro}
                onMove={(i, d) => set({ phones: move(form.phones, i, d) })}
                onRemove={(i) => set({ phones: form.phones.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          {canEdit && form.phones.length < FOOTER_LIMITS.phones ? (
            <button type="button" className={addBtn} onClick={() => set({ phones: [...form.phones, ""] })}>
              <FiPlus size={13} /> افزودن شماره
            </button>
          ) : null}
        </div>
        <Field label="آدرس">
          <textarea rows={2} className={`${inputClass} resize-y leading-7`} value={form.address} disabled={ro} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="ایمیل">
          <input dir="ltr" type="email" className={`${inputClass} text-left`} value={form.email} disabled={ro} onChange={(e) => set({ email: e.target.value })} placeholder="info@example.com" />
        </Field>
      </Card>

      <Card title="شبکه‌های اجتماعی" hint="فقط آیکون‌های فعال با لینک در فوتر نمایش داده می‌شوند">
        {form.socials.map((s, i) => {
          const { label } = SOCIAL_PLATFORMS.find((p) => p.key === s.key);
          const update = (patch) => set({ socials: form.socials.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={s.key} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" checked={s.enabled} disabled={ro} onChange={(e) => update({ enabled: e.target.checked })} />
                {label}
              </label>
              <input dir="ltr" className={`${inputClass} text-left`} value={s.url} disabled={ro} placeholder="https://" onChange={(e) => update({ url: e.target.value })} />
            </div>
          );
        })}
      </Card>

      <Card title="ستون‌های لینک" hint="لینک داخلی با / شروع می‌شود (مثل /about)؛ لینک بیرونی با https://">
        {form.sections.map((section, si) => (
          <div key={si} className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} bg-white`}
                value={section.title}
                disabled={ro}
                placeholder="عنوان ستون"
                onChange={(e) => setSection(si, { title: e.target.value })}
              />
              <MoveButtons
                i={si}
                length={form.sections.length}
                disabled={ro}
                onMove={(i, d) => set({ sections: move(form.sections, i, d) })}
                onRemove={(i) => set({ sections: form.sections.filter((_, j) => j !== i) })}
              />
            </div>
            {section.links.map((link, li) => (
              <div key={li} className="flex flex-wrap items-center gap-2 ps-4 sm:flex-nowrap">
                <input className={`${inputClass} bg-white`} value={link.label} disabled={ro} placeholder="متن لینک" onChange={(e) => setLink(si, li, { label: e.target.value })} />
                <input dir="ltr" className={`${inputClass} bg-white text-left`} value={link.href} disabled={ro} placeholder="/about" onChange={(e) => setLink(si, li, { href: e.target.value })} />
                <MoveButtons
                  i={li}
                  length={section.links.length}
                  disabled={ro}
                  onMove={(i, d) => setSection(si, { links: move(section.links, i, d) })}
                  onRemove={(i) => setSection(si, { links: section.links.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            {canEdit && section.links.length < FOOTER_LIMITS.links ? (
              <button type="button" className={`${addBtn} ms-4`} onClick={() => setSection(si, { links: [...section.links, { label: "", href: "" }] })}>
                <FiPlus size={13} /> افزودن لینک
              </button>
            ) : null}
          </div>
        ))}
        {canEdit && form.sections.length < FOOTER_LIMITS.sections ? (
          <button type="button" className={addBtn} onClick={() => set({ sections: [...form.sections, { title: "", links: [{ label: "", href: "" }] }] })}>
            <FiPlus size={13} /> افزودن ستون
          </button>
        ) : null}
      </Card>

      {isFeatureEnabled("newsletter") ? (
        <Card title="خبرنامه" hint="نوار عضویت در خبرنامه بالای فوتر">
          <div className="grid gap-4 sm:grid-cols-2">
            {NEWSLETTER_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={inputClass}
                  value={form.newsletter[key]}
                  disabled={ro}
                  onChange={(e) => set({ newsletter: { ...form.newsletter, [key]: e.target.value } })}
                />
              </Field>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="متن کپی‌رایت" hint="وسط‌چین در پایین فوتر. {year} با سال جاری جایگزین می‌شود.">
        <input className={inputClass} value={form.copyright} disabled={ro} onChange={(e) => set({ copyright: e.target.value })} />
      </Card>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-gray-100 bg-white/95 py-4 backdrop-blur">
        {canEdit ? (
          <>
            <button
              type="submit"
              disabled={saving || uploading || !dirty}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? "در حال ذخیره..." : "ذخیره فوتر"}
            </button>
            <button
              type="button"
              onClick={() => setForm(defaultSiteFooter())}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-500 transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40"
            >
              <FiRefreshCcw /> بازگردانی پیش‌فرض
            </button>
          </>
        ) : (
          <p className="text-xs font-bold text-gray-400">دسترسی ویرایش فوتر را ندارید — مقادیر فقط برای مشاهده‌اند.</p>
        )}
      </div>
    </form>
  );
}
