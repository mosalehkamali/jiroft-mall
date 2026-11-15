"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";

const fa = (n) => Number(n || 0).toLocaleString("fa-IR");
const when = (d) => (d ? new Date(d).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** حسابداری محک: وضعیت اتصالِ هر حساب، کالاهای بدونِ عکس و فاکتورهای ثبت‌نشده. */
export default function MahakPage() {
  const { can } = useAdminPermissions();
  const canSync = can("mahak.sync");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () =>
    fetch("/api/admin/mahak")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("خطا در دریافت وضعیت محک"));

  useEffect(() => {
    load();
  }, []);

  const act = async (body, label) => {
    setBusy(label);
    try {
      const res = await fetch("/api/admin/mahak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "خطا");
      const errors = (json.sync?.accounts || []).filter((a) => a.error).map((a) => `${a.key}: ${a.error}`);
      if (errors.length) toast.error(errors.join(" | "));
      else if (json.result?.state === "failed") toast.error(json.result.error || "ثبت فاکتور ناموفق بود");
      else toast.success("انجام شد");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  const waiting = data.accounts.reduce((s, a) => s + a.waiting, 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">حسابداری محک</h1>
          <p className="mt-1 text-sm text-gray-500">
            کالا، قیمت و موجودی هر ساعت از محک خوانده می‌شود. کالایی در سایت نمایش داده می‌شود که هم عکس اصلی و هم موجودی داشته باشد.
          </p>
        </div>
        {canSync && (
          <button
            onClick={() => act({ action: "sync" }, "sync")}
            disabled={!!busy}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "sync" ? "در حال همگام‌سازی…" : "همگام‌سازی الان"}
          </button>
        )}
      </div>

      {waiting > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {fa(waiting)} کالا دریافت شده و هنوز در سایت ساخته نشده است. «همگام‌سازی الان» را دوباره بزنید (هر بار بخشی ساخته می‌شود).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.accounts.map((a) => (
          <div key={a.key} className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{a.label}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  !a.configured ? "bg-gray-100 text-gray-500" : a.lastError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                }`}
              >
                {!a.configured ? "تنظیم نشده" : a.lastError ? "خطا" : a.lastSyncAt ? "متصل" : "در انتظار اولین همگام‌سازی"}
              </span>
            </div>
            {!a.configured ? (
              <p className="mt-3 text-xs leading-6 text-gray-500" dir="ltr">
                MAHAK_{a.key.toUpperCase()}_USERNAME / _PASSWORD / _DATABASE_ID / _PACKAGE_NO
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm text-gray-600">
                <dt>کالاها</dt>
                <dd className="text-left font-bold text-gray-900">{fa(a.items)}</dd>
                <dt>دارای موجودی</dt>
                <dd className="text-left font-bold text-gray-900">{fa(a.inStock)}</dd>
                <dt>آخرین همگام‌سازی</dt>
                <dd className="text-left">{when(a.lastSyncAt)}</dd>
                <dt>شناسه ویزیتور</dt>
                <dd className="text-left">{a.visitorId ?? "—"}</dd>
              </dl>
            )}
            {a.lastError && <p className="mt-3 break-words text-xs leading-5 text-red-600">{a.lastError}</p>}
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-600">
        کالاهای محک که الان در سایت نمایش داده می‌شوند: <b className="text-gray-900">{fa(data.published)}</b>
      </p>

      <section className="rounded-2xl border bg-white shadow-sm">
        <h2 className="border-b px-5 py-3 text-sm font-bold text-gray-900">
          موجود در انبار، بدون عکس ({fa(data.needImageCount)}
          {data.needImageCount >= 200 ? "+" : ""})
        </h2>
        {data.needImage.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">همه‌ی کالاهای موجود عکس دارند.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-auto">
            {data.needImage.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="truncate text-gray-800">{p.name}</span>
                <Link href={`/p-admin/admin-products/edit/${p._id}`} className="shrink-0 font-bold text-blue-600">
                  افزودن عکس
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-bold text-gray-900">فاکتورهای ثبت‌نشده در محک ({fa(data.failedOrders.length)})</h2>
          {canSync && data.failedOrders.length > 0 && (
            <button onClick={() => act({ action: "retry" }, "retry")} disabled={!!busy} className="text-sm font-bold text-blue-600 disabled:opacity-50">
              ارسال مجدد همه
            </button>
          )}
        </div>
        {data.failedOrders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">فاکتور معوقی وجود ندارد.</p>
        ) : (
          <ul className="divide-y">
            {data.failedOrders.map((o) => (
              <li key={o._id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/p-admin/admin-orders/${o._id}`} className="font-bold text-gray-900">
                    {o.trackingCode}
                  </Link>
                  {canSync && (
                    <button onClick={() => act({ action: "retry", orderId: o._id }, o._id)} disabled={!!busy} className="font-bold text-blue-600 disabled:opacity-50">
                      {busy === o._id ? "…" : "ارسال مجدد"}
                    </button>
                  )}
                </div>
                {o.mahak?.error && <p className="mt-1 break-words text-xs leading-5 text-red-600">{o.mahak.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
