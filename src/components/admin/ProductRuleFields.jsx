"use client";

/**
 * Admin form pieces driven by the store's product rules (src/lib/productRules.js):
 * labels with the stage a field is required at, the store's custom fields,
 * and SKU / stock / "not for sale". Shared by the create and edit forms so the
 * two can never offer different fields.
 */
import Input from "@/components/admin/Input";
import Textarea from "@/components/admin/Textarea";
import Select from "@/components/admin/Select";

const STAGE_HINT = {
  draft: "الزامی",
  published: "الزامی برای انتشار",
  purchasable: "الزامی برای فروش",
};

/** "برند *" — with a tooltip naming the stage the field becomes required at. */
export function RuleLabel({ rule, children }) {
  const text = children || rule?.label;
  if (!rule?.required) return text;
  return (
    <>
      {text}{" "}
      <span className="text-red-500" title={STAGE_HINT[rule.required]}>
        *
      </span>
      {rule.required !== "draft" && (
        <span className="mr-1 text-[10px] font-normal text-gray-400">({STAGE_HINT[rule.required]})</span>
      )}
    </>
  );
}

export function CustomFieldsEditor({ rules, values = {}, onChange, errors = {} }) {
  const fields = (rules?.customFields || []).filter((f) => f.admin);
  if (!fields.length) return null;
  const set = (key, value) => onChange({ ...values, [key]: value });

  return (
    <div className="border-t pt-6">
      <h3 className="font-bold mb-4">اطلاعات تکمیلی</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {fields.map((f) => {
          const label = (
            <>
              <RuleLabel rule={f} />
              {!f.public && <span className="mr-1 text-[10px] font-normal text-gray-400">(داخلی — به مشتری نمایش داده نمی‌شود)</span>}
            </>
          );
          const error = errors[`customFields.${f.key}`];
          const value = values?.[f.key];
          if (f.type === "boolean") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={value === true} onChange={(e) => set(f.key, e.target.checked)} />
                {label}
                {error && <span className="text-xs text-red-500 font-bold">! {error}</span>}
              </label>
            );
          }
          if (f.type === "select") {
            return (
              <Select
                key={f.key}
                label={label}
                error={error}
                value={value ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                options={[{ value: "", label: "—" }, ...(f.options || []).map((o) => ({ value: String(o?.value ?? o), label: String(o?.label ?? o) }))]}
              />
            );
          }
          if (f.type === "textarea") {
            return (
              <Textarea key={f.key} label={label} rows={3} error={error} value={value ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            );
          }
          return (
            <Input
              key={f.key}
              label={label}
              error={error}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              dir={f.type === "url" ? "ltr" : undefined}
              value={value ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

/** SKU (optional — generated when empty), stock and the "not for sale" switch. */
export function SaleFields({ rules, formData, updateField, errors = {}, skuPlaceholder = "خالی = ساخت خودکار" }) {
  const sku = rules?.fields?.sku;
  const stock = rules?.fields?.stock;
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {sku?.admin && (
        <Input
          label={<RuleLabel rule={sku} />}
          dir="ltr"
          error={errors.sku}
          placeholder={skuPlaceholder}
          value={formData.sku || ""}
          onChange={(e) => updateField("sku", e.target.value)}
        />
      )}
      {stock?.admin && (
        <Input
          label={<RuleLabel rule={stock}>{stock.label} <span className="text-[10px] font-normal text-gray-400">(خالی = بدون کنترل موجودی)</span></RuleLabel>}
          type="number"
          min="0"
          error={errors.stock}
          value={formData.stock ?? ""}
          onChange={(e) => updateField("stock", e.target.value)}
        />
      )}
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 self-end pb-3">
        <input
          type="checkbox"
          checked={formData.purchasable !== false}
          onChange={(e) => updateField("purchasable", e.target.checked)}
        />
        قابل فروش (اگر برداشته شود، محصول نمایش داده می‌شود ولی خریدنی نیست)
      </label>
    </div>
  );
}
