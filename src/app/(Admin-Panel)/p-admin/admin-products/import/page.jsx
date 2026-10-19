'use client';

/**
 * Bulk product import: a spreadsheet (xlsx/csv) or JSON → rows → dry run →
 * import. Every row goes through POST /api/product/import, i.e. the same
 * validation as the admin form (store rules, category attributes).
 *
 * Spreadsheet columns (first row = headers):
 *   name, sku, category (slug or id), brand (slug or id), basePrice,
 *   shortDescription, longDescription, mainImage, gallery (comma separated),
 *   tag (comma separated), stock, isActive (1/0/true/false),
 *   attr.<attribute name>   → category attribute
 *   custom.<field key>      → custom field (store.config.js)
 */
import { useState } from 'react';
import Link from 'next/link';
import { FiUpload, FiCheckCircle, FiXCircle, FiArrowRight } from 'react-icons/fi';
import { invalidateAdminCache } from '@/lib/adminCache';
import { resolveProductRules } from '@/lib/productRules';

const RULES = resolveProductRules([]);
const truthy = (v) => ['1', 'true', 'yes', 'بله', 'فعال'].includes(String(v).trim().toLowerCase());

/** One spreadsheet row → the create-product payload. */
function rowToPayload(row) {
  const out = { attributes: {}, customFields: {} };
  for (const [rawKey, value] of Object.entries(row)) {
    const key = String(rawKey).trim();
    if (value === '' || value == null) continue;
    if (key.startsWith('attr.')) out.attributes[key.slice(5)] = value;
    else if (key.startsWith('custom.')) out.customFields[key.slice(7)] = value;
    else if (key === 'gallery' || key === 'tag') out[key] = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'isActive' || key === 'purchasable') out[key] = truthy(value);
    else out[key] = typeof value === 'string' ? value.trim() : value;
  }
  if (!Object.keys(out.attributes).length) delete out.attributes;
  if (!Object.keys(out.customFields).length) delete out.customFields;
  return out;
}

async function readFile(file) {
  if (/\.json$/i.test(file.name)) {
    const data = JSON.parse(await file.text());
    return Array.isArray(data) ? data : data.products || [];
  }
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(rowToPayload);
}

export default function ProductImportPage() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setReport(null);
    try {
      const parsed = await readFile(file);
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(`فایل خوانده نشد: ${err.message}`);
    }
  };

  const run = async (dryRun) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/product/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: rows, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'خطا در ورود محصولات');
      setReport(data);
      if (!dryRun && data.created) invalidateAdminCache('/api/product');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    'name', 'sku', 'category', 'brand', 'basePrice', 'shortDescription', 'mainImage', 'gallery', 'tag',
    ...(RULES.fields.stock.use ? ['stock'] : []), 'isActive',
    ...RULES.customFields.map((f) => `custom.${f.key}`),
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ورود گروهی محصولات</h1>
          <p className="text-sm text-gray-500 mt-1">
            هر ردیف با همان قوانینِ فرمِ افزودن محصول بررسی می‌شود؛ ردیف‌های نامعتبر گزارش و بقیه وارد می‌شوند.
          </p>
        </div>
        <Link href="/p-admin/admin-products" className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900">
          <FiArrowRight /> بازگشت به محصولات
        </Link>
      </div>

      <div className="bg-white rounded-[var(--radius)] border border-gray-100 p-6 space-y-4">
        <p className="text-sm text-gray-600">
          فایل Excel/CSV (ردیف اول = نام ستون‌ها) یا JSON. ستون‌ها:
        </p>
        <div className="flex flex-wrap gap-1.5" dir="ltr">
          {columns.map((c) => (
            <code key={c} className="text-xs bg-gray-100 rounded px-2 py-0.5">{c}</code>
          ))}
          <code className="text-xs bg-gray-100 rounded px-2 py-0.5">attr.&lt;ویژگی دسته&gt;</code>
        </div>
        <p className="text-xs text-gray-400">
          category و brand با اسلاگ یا شناسه؛ gallery و tag با کاما جدا می‌شوند؛ isActive خالی = منتشرشده.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white cursor-pointer" style={{ background: 'var(--color-primary)' }}>
          <FiUpload /> انتخاب فایل
          <input type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="mr-3 text-sm text-gray-600">{fileName} — {rows.length} ردیف</span>}
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => run(true)} className="px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold border-2 border-gray-200 bg-white hover:border-gray-300 disabled:opacity-50">
            بررسی بدون ذخیره
          </button>
          <button disabled={busy} onClick={() => run(false)} className="px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
            ورود {rows.length} محصول
          </button>
        </div>
      )}

      {report && (
        <div className="bg-white rounded-[var(--radius)] border border-gray-100 p-6">
          <p className="font-bold mb-4">
            {report.dryRun ? 'نتیجه‌ی بررسی' : 'نتیجه‌ی ورود'}: {report.created} موفق، {report.failed} ناموفق
          </p>
          <ul className="divide-y divide-gray-100">
            {report.results.map((r) => (
              <li key={r.index} className="py-2 text-sm flex items-start gap-2">
                {r.ok ? <FiCheckCircle className="text-green-600 mt-0.5 shrink-0" /> : <FiXCircle className="text-red-600 mt-0.5 shrink-0" />}
                <span className="text-gray-400 w-10 shrink-0">#{r.index + 1}</span>
                <span className="font-medium">{rows[r.index]?.name || '—'}</span>
                {!r.ok && (
                  <span className="text-red-600">
                    {r.error}
                    {Object.keys(r.fieldErrors || {}).length > 1 && ` (${Object.values(r.fieldErrors).join('، ')})`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
