"use client";

/**
 * Extra settings of a category attribute, shared by the category add and edit
 * forms: customer visibility, storefront search, and validation (min/max for
 * numbers, a pattern for text). Stored on Category.attributes[] and enforced
 * by validateProductFields + the storefront (src/lib/productRules.js).
 */
export default function AttributeRuleFields({ value, onChange }) {
  const v = value || {};
  const box = "flex items-center gap-2 text-sm font-bold cursor-pointer select-none";
  const input = "w-full border rounded px-3 py-2 text-sm";
  return (
    <div className="grid md:grid-cols-2 gap-4 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex flex-col gap-3">
        <label className={box}>
          <input
            type="checkbox"
            checked={v.isPublic !== false}
            onChange={(e) => onChange({ isPublic: e.target.checked })}
            className="w-5 h-5 rounded accent-[var(--color-primary)]"
          />
          نمایش به مشتری (برداشتن تیک = اطلاعات داخلی)
        </label>
        <label className={box}>
          <input
            type="checkbox"
            checked={!!v.searchable}
            onChange={(e) => onChange({ searchable: e.target.checked })}
            className="w-5 h-5 rounded accent-[var(--color-primary)]"
          />
          قابل جستجو در سایت
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-gray-500">
          حداقل (عددی)
          <input type="number" className={input} value={v.min ?? ""} onChange={(e) => onChange({ min: e.target.value })} />
        </label>
        <label className="text-xs text-gray-500">
          حداکثر (عددی)
          <input type="number" className={input} value={v.max ?? ""} onChange={(e) => onChange({ max: e.target.value })} />
        </label>
        <label className="text-xs text-gray-500">
          الگو (RegExp)
          <input dir="ltr" className={input} value={v.pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value })} placeholder="^[A-Z0-9-]+$" />
        </label>
      </div>
    </div>
  );
}

/** Form state → the stored shape. */
export function attributeRulePayload(a = {}) {
  const num = (x) => (x === "" || x == null || !Number.isFinite(Number(x)) ? null : Number(x));
  return {
    isPublic: a.isPublic !== false,
    searchable: !!a.searchable,
    min: num(a.min),
    max: num(a.max),
    pattern: typeof a.pattern === "string" ? a.pattern.trim() : "",
  };
}

/** Stored shape → form state. */
export function attributeRuleState(a = {}) {
  return {
    isPublic: a.isPublic !== false,
    searchable: !!a.searchable,
    min: a.min ?? "",
    max: a.max ?? "",
    pattern: a.pattern || "",
  };
}
