"use client";

import storeConfig from "base/store.config";
import { getUserFullName } from "base/utils/userName";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  FiSearch,
  FiShoppingCart,
  FiUser,
  FiX,
  FiChevronLeft,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineViewGrid } from "react-icons/hi";
import Image from "next/image";
import Link from "next/link";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
import CartDrawer from "@/components/features/cartDrawer/CartDrawer";
import UserNotificationBell from "@/components/features/notifications/UserNotificationBell";
import { useUser } from "@/components/features/auth/UserContext";
import { getCartTotalQuantity } from "@/lib/cart";
import MegamenuInteractiveColumns from "@/components/features/navbar/MegamenuInteractiveColumns";
import {
  AUDIENCE_OPTIONS,
  collectAvailableAudiences,
  filterNavDataByAudience,
  withQueryParams,
} from "@/lib/navbarAudience";
import { isFeatureEnabled, isHrefEnabled } from "@/lib/features";
import { catalogPath } from "@/lib/catalogPath";

// لینک‌های کنارِ دکمه‌ی دسته‌بندی — از store.config.js؛ لینکِ قابلیتِ خاموش حذف می‌شود.
const NAVIGATION_ITEMS = (storeConfig.navigation?.header || []).filter((item) => isHrefEnabled(item.href));
const AUDIENCE_ON = isFeatureEnabled("targetAudience");
const DEPARTMENTS_ON = isFeatureEnabled("departments");
const SECOND_HAND_ON = isFeatureEnabled("secondHand");
// فروشگاهِ «استعلامی/نمایشی» سبد خرید ندارد
const CART_ON = (storeConfig.commerce?.purchase?.mode || "cart") === "cart";
const BROADCASTS_ON = isFeatureEnabled("broadcasts");

// آیکون برند/دسته را به صورت ماسک با رنگ متن (سفید) نمایش می‌دهد
const iconMaskStyle = (url) => ({
  backgroundColor: "currentColor",
  maskImage: `url(${url})`,
  WebkitMaskImage: `url(${url})`,
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskSize: "contain",
  WebkitMaskSize: "contain",
});

// ---- Search Result Item ----
function SearchResultItem({ product, onClick }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-all rounded-lg group"
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <FiSearch size={14} />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-white text-sm font-bold truncate group-hover:text-[var(--color-primary)] transition-colors">
          {product.name}
        </span>
        {product.category?.title && (
          <span className="text-gray-400 text-xs truncate">
            {product.category.title}
          </span>
        )}
      </div>
    </Link>
  );
}

// ---- Audience Tabs (ستونِ «مخاطبِ هدف» — پیش از ورزش‌ها) ----
// انتخابش کاملاً کلاینتی است (روی navData ی از پیش کش‌شده فیلتر می‌کند)؛
// «همه محصولات» = null یعنی بدونِ فیلتر.
function AudienceTabs({ selected, onSelect, availableAudiences, className = "" }) {
  const options = AUDIENCE_OPTIONS.filter((a) => availableAudiences.has(a));
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {["همه محصولات", ...options].map((label) => {
        const value = label === "همه محصولات" ? null : label;
        const isActive = selected === value;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(value)}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap transition-all ${
              isActive
                ? "bg-[var(--color-primary)] text-white"
                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-[var(--color-primary)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// تابع کمکی برای استایل دکمه‌های لیست در ستون‌های مگامنو (ورزش‌ها + مخاطبِ هدف)
// — سطحِ ماژول تا هم CategoryMenu و هم AudienceColumn عیناً همان استایل را به‌کار ببرند.
const listButtonStyle = (isActive) => `
  group w-full flex items-center gap-3 px-4 py-2.5 rounded-[6px] transition-all text-[15px] font-medium
  ${
    isActive
      ? "bg-[#ffffff1a] text-[var(--color-primary)]"
      : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[var(--color-primary)]"
  }
`;

// ---- Audience Column (ستونِ اختصاصیِ مخاطبِ هدف — دسکتاپ، پیش از ستونِ ورزش‌ها) ----
// باریک‌تر از سایر ستون‌ها (فقط چند برچسبِ کوتاه لازم دارد)؛ دقیقاً با همان
// توکن‌های تایپوگرافی/رنگ/هاور/حالتِ فعالِ ستونِ ورزش‌ها (listButtonStyle) رندر می‌شود.
// گزینه‌ای که هیچ محصولی ندارد (availableAudiences آن را شامل نشود) اصلاً رندر نمی‌شود؛
// «همه محصولات» چون فیلتر نیست همیشه نمایش داده می‌شود.
function AudienceColumn({ selected, onSelect, availableAudiences }) {
  const options = AUDIENCE_OPTIONS.filter((a) => availableAudiences.has(a));

  return (
    <div className="w-[150px] shrink-0 border-l border-white/[0.06] p-3 overflow-y-auto bg-white/[0.01]">
      <p className="text-[11px] font-bold text-gray-500 mb-8 px-2 uppercase tracking-widest"/>
      <ul className="space-y-1">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={listButtonStyle(selected === null)}
          >
            <span className="flex-grow text-right">همه محصولات</span>
          </button>
        </li>
        {options.map((label) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onSelect(label)}
              className={listButtonStyle(selected === label)}
            >
              <span className="flex-grow text-right">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Mega Menu ----
function CategoryMenu({
  navData,
  onClose,
  selectedAudience,
  onSelectAudience,
  availableAudiences,
}) {
  const [activeSportId, setActiveSportId] = useState(navData[0]?._id || null);

  // پیدا کردن ورزش فعال
  const activeSport =
    navData.find((s) => s._id === activeSportId) || navData[0];

  return (
    <div
      dir="rtl"
      className="absolute top-full right-0 mt-2 w-[1100px] bg-[#20232ae6] border border-white/10 shadow-2xl rounded-[6px] overflow-hidden z-[100] text-right"
      onMouseLeave={onClose}
    >
      <div className="flex h-[480px]">
        {/* ستونِ اختصاصیِ مخاطبِ هدف — پیش از ستونِ دپارتمان‌ها */}
        {AUDIENCE_ON && (
          <AudienceColumn
            selected={selectedAudience}
            onSelect={onSelectAudience}
            availableAudiences={availableAudiences}
          />
        )}
        {/* ستون دپارتمان‌ها — بدونِ این قابلیت کلِ کاتالوگ یک ریشه است و ستونی لازم نیست */}
        {DEPARTMENTS_ON && (
        <div className="w-[30%] border-l border-white/[0.06] p-3 overflow-y-auto bg-white/[0.01]">
          <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
            {storeConfig.catalog.departmentLabelPlural}
          </p>
          <ul className="space-y-1">
            {navData.map((sport) => (
              <li key={sport._id}>
                <Link
                  href={withQueryParams(catalogPath(sport.slug), { targetAudience: selectedAudience })}
                  prefetch
                  onClick={onClose}
                  onMouseEnter={() => setActiveSportId(sport._id)}
                  className={listButtonStyle(activeSportId === sport._id)}
                >
                  {sport.icon && (
                    <div
                      style={iconMaskStyle(sport.icon)}
                      className="w-5 h-5 shrink-0"
                    />
                  )}
                  <span className="flex-grow text-right">{sport.title}</span>
                  <FiChevronLeft
                    size={16}
                    className={
                      activeSportId === sport._id ? "opacity-100" : "opacity-20"
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        )}
        {/* ستون‌های دوم/سوم/چهارم: درختِ دسته‌ها + نوار جنسیت + برندها
            (کامپوننتِ کلاینتِ ایزوله — state تعاملیِ جنسیت آنجا نگه‌داری می‌شود) */}
        <MegamenuInteractiveColumns
          sport={activeSport}
          onClose={onClose}
          selectedAudience={selectedAudience}
        />
      </div>
    </div>
  );
}

// ---- Desktop panels (catalog without departments) ----
// The top-level categories are buttons in the navbar; each opens its own branch
// here, and «دسته‌بندی محصولات» opens every category grouped by top level.
const PANEL_FRAME =
  "absolute top-full inset-x-0 z-[100] border border-white/10 bg-[#20232af2] text-right shadow-2xl backdrop-blur";

function RootCategoryPanel({ sport, rootId, onClose, selectedAudience, onSelectAudience, availableAudiences }) {
  return (
    <div dir="rtl" className={PANEL_FRAME}>
      <div className="flex h-[420px]">
        {AUDIENCE_ON && (
          <AudienceColumn selected={selectedAudience} onSelect={onSelectAudience} availableAudiences={availableAudiences} />
        )}
        <MegamenuInteractiveColumns key={rootId} sport={sport} rootId={rootId} onClose={onClose} selectedAudience={selectedAudience} />
      </div>
    </div>
  );
}

function AllCategoriesPanel({ sport, roots, onClose, selectedAudience, inline = false }) {
  const categories = sport?.categories || [];
  const link = (cat) => withQueryParams(catalogPath(sport.slug, cat.slug), { targetAudience: selectedAudience });
  return (
    <div dir="rtl" className={inline ? "" : PANEL_FRAME}>
      <div className="all-categories gap-x-6 gap-y-6 p-4 lg:gap-8 lg:p-6" style={{ "--cols": Math.min(Math.max(roots.length, 1), 6) }}>
        {roots.map((root) => (
          <div key={root._id} className="min-w-0">
            <Link href={link(root)} prefetch onClick={onClose} className="mb-3 block border-b border-white/10 pb-2 text-sm font-bold text-white transition-colors hover:text-[var(--color-secondary)]">
              {root.title}
            </Link>
            <ul className="space-y-2">
              {categories.filter((c) => c.parent === root._id).map((c) => (
                <li key={c._id}>
                  <Link href={link(c)} prefetch onClick={onClose} className="text-[13px] text-gray-300 transition-colors hover:text-white">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Phone version of RootCategoryPanel: no hover, so the branch is a plain list
// (children, then the brands found anywhere in the branch).
function MobileRootPanel({ sport, rootId, onClose, selectedAudience }) {
  const categories = sport?.categories || [];
  const root = categories.find((c) => c._id === rootId);
  if (!root) return null;
  const link = (...slugs) => withQueryParams(catalogPath(sport.slug, ...slugs), { targetAudience: selectedAudience });
  const kids = categories.filter((c) => c.parent === root._id);
  const brands = [...new Map([root, ...kids].flatMap((c) => c.brands || []).map((b) => [b._id, b])).values()];
  return (
    <div className="space-y-5 p-4">
      <Link href={link(root.slug)} onClick={onClose} className="flex items-center gap-1 text-sm text-white">
        مشاهده همه {root.title}
        <FiChevronLeft size={16} />
      </Link>
      {kids.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
          {kids.map((c) => (
            <li key={c._id}>
              <Link href={link(c.slug)} onClick={onClose} className="text-[13px] text-gray-300">{c.title}</Link>
            </li>
          ))}
        </ul>
      )}
      {brands.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] text-gray-500">برندها</p>
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <Link key={b._id} href={link(root.slug, b.slug)} onClick={onClose} className="border border-white/15 px-2.5 py-1 text-xs text-gray-300">
                {b.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Mobile Two-Pane Master-Detail Category Drawer ----
// چیدمانِ موبایل‌نیتیوِ دو-پنلی (الگوی دیجی‌کالا/آمازون):
//   سقف (۱۰۰٪): تب‌های ورزش + نوارِ فیلترِ ویژگیِ دسته‌ی فعال (پویا)
//   بدنه: پنل A (راست، ۴۰٪) لیستِ دسته‌ها (مَستر) | پنل B (چپ، ۶۰٪) برندها (دیتیل)
// هر دو پنل اسکرولِ مستقل دارند؛ ارتفاعِ بدنه به فضای باقی‌مانده‌ی زیرِ سقف مقید است.
function MobileCategoryDrawer({ navData, onClose, selectedAudience, onSelectAudience, availableAudiences }) {
  // ورزشِ فعال (تب‌های سقف) — پیش‌فرض اولین ورزش
  const [activeSportId, setActiveSportId] = useState(navData[0]?._id || null);
  // مقدارِ فعالِ فیلتر (مخصوصِ دسته‌ی فعال)؛ کلیکِ دوباره خاموش می‌کند
  const [activeFilterValue, setActiveFilterValue] = useState(null);
  // دسته‌ی فعال (مَسترِ پنل A) که محتوای پنل B را هدایت می‌کند
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  const toggleFilterValue = (v) =>
    setActiveFilterValue((prev) => (prev === v ? null : v));

  // سوییچِ ورزش → ریستِ دسته‌ی فعال تا Auto-Mount اولین دسته‌ی ورزشِ جدید را انتخاب کند
  const selectSport = (id) => {
    setActiveSportId(id);
    setActiveCategoryId(null);
    setExpandedCategoryId(null);
  };

  const activeSport =
    navData.find((s) => s._id === activeSportId) || navData[0] || null;

  // ── درختِ دسته‌ها: فقط دسته‌های والد در مَستر (پنل A) ──
  const categories = activeSport?.categories || [];
  const catIdSet = new Set(categories.map((c) => c._id));
  const rootCategories = categories.filter(
    (c) => !c.parent || !catIdSet.has(c.parent),
  );
  const childrenOf = (id) =>
    categories.filter((c) => c.parent && c.parent === id);

  // Auto-Mount: اگر دسته‌ی فعال معتبر نباشد، اولین دسته انتخاب می‌شود تا پنل B هرگز خالی نماند
  // دسته‌ی ساختاری (بدونِ محصولِ مستقیم) انتخاب نمی‌شود چون برند/صفحه‌ای ندارد.
  const firstWithProducts =
    rootCategories.find((c) => c.hasProducts !== false) ||
    categories.find((c) => c.hasProducts !== false);
  const effectiveCatId = categories.some((c) => c._id === activeCategoryId)
    ? activeCategoryId
    : firstWithProducts?._id || null;
  const activeCategory =
    categories.find((c) => c._id === effectiveCatId) || null;

  // ── فیلترِ ویژگیِ دسته‌ی فعال (پویا) — همان داده‌ی مگامنوی دسکتاپ از navbarService ──
  const megaMenuFilter = activeCategory?.megaMenuFilter || null;
  // مقدار فقط وقتی اعمال می‌شود که جزوِ مقادیرِ همین دسته باشد (با تعویضِ دسته نادیده می‌شود)
  const appliedValue =
    megaMenuFilter && (megaMenuFilter.values || []).includes(activeFilterValue)
      ? activeFilterValue
      : null;

  // موتورِ وراثتِ URL — فیلترِ ویژگیِ دسته (?[attrName]=<value>) و مخاطبِ هدف
  // (?targetAudience=<value>) هر دو، مستقل از هم، به لینک‌ها افزوده می‌شوند
  const withFilterForCategory = (category, href) => {
    const filter = category?.megaMenuFilter || null;
    const value =
      filter && (filter.values || []).includes(activeFilterValue)
        ? activeFilterValue
        : null;

    return withQueryParams(href, {
      ...(value && { [filter.name]: value }),
      targetAudience: selectedAudience,
    });
  };

  const withFilter = (href) => withFilterForCategory(activeCategory, href);

  // ── برندهای پنل B: عضویت از دسته‌ی فعال (از روی محصول)، فیلترشده با مقدارِ فعال ──
  const categoryBrands = activeCategory?.brands || [];
  const visibleBrands = appliedValue
    ? categoryBrands.filter((b) =>
        (b.filterValues || []).includes(appliedValue),
      )
    : categoryBrands;

  return (
    <>
      {/* Overlay تیره پشت منو (Framer — دست‌نخورده) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
        onClick={onClose}
      />

      {/* پنل کشویی از سمت راست (Framer slide-in — دست‌نخورده) */}
      <motion.div
        dir="rtl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-[#1a1c22] z-[120] shadow-2xl flex flex-col"
      >
        {/* ───────── سقف: عنوان + بستن ───────── */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#20232a] flex-shrink-0">
          <span className="text-white font-bold text-sm truncate">
            دسته‌بندی محصولات
          </span>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="text-white flex-shrink-0"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* ───────── سقف: تب‌های مخاطبِ هدف (اسکرولِ افقی) ───────── */}
        {AUDIENCE_ON && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-white/10 flex-shrink-0">
          <AudienceTabs selected={selectedAudience} onSelect={onSelectAudience} availableAudiences={availableAudiences} />
        </div>
        )}

        {/* ───────── سقف: تب‌های دپارتمان (اسکرولِ افقی) ───────── */}
        <div className={`${DEPARTMENTS_ON ? "flex" : "hidden"} gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-white/10 flex-shrink-0`}>
          {navData.map((sport) => {
            const isActive = sport._id === activeSportId;
            return (
              <button
                key={sport._id}
                onClick={() => selectSport(sport._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {sport.icon && (
                  <img
                    src={sport.icon}
                    alt=""
                    className="w-4 h-4 invert opacity-90"
                  />
                )}
                {sport.title}
              </button>
            );
          })}
        </div>

        {/* ───────── سقف: نوارِ فیلترِ ویژگیِ دسته‌ی فعال (پویا — فقط اگر دسته فیلتر داشته باشد) ───────── */}
        {megaMenuFilter && megaMenuFilter.values.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 flex-shrink-0 overflow-x-auto">
            <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap flex-shrink-0">
              {megaMenuFilter.label}:
            </span>
            {megaMenuFilter.values.map((value) => {
              const isActive = appliedValue === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleFilterValue(value)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-[var(--color-primary)]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        )}

        {/* ───────── بدنه: ستونِ اسکرول‌شونده — دو پنلِ ۴۰/۶۰ + کارتِ جمعه بازار بلافاصله زیرشان ───────── */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="flex flex-row">
          {/* PANE A — مَستر/دسته‌ها (در RTL سمت راست) — ۴۰٪ */}
          <div className="w-[40%] flex-shrink-0 border-l border-white/10">
            {activeSport?.slug && (
              <Link
                href={withQueryParams(catalogPath(activeSport.slug), { targetAudience: selectedAudience })}
                onClick={onClose}
                className="m-2 mb-1 flex min-h-10 items-center justify-center rounded-[6px] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2 py-2 text-center text-[11px] font-bold leading-5 text-[var(--color-secondary)] transition-colors hover:border-[var(--color-primary)]/70 hover:bg-[var(--color-primary)]/20"
              >
                مشاهده صفحه {activeSport.title}
              </Link>
            )}

            {rootCategories.length > 0 ? (
              <ul className="pb-2">
                {rootCategories.map((cat) => {
                  const kids = childrenOf(cat._id);
                  const isActive = cat._id === effectiveCatId;
                  const isExpanded = expandedCategoryId === cat._id;
                  const isStructural = cat.hasProducts === false;
                  // ساختاری بدونِ فرزندِ قابل‌نمایش (مثلاً بعد از فیلترِ جنسیت) = آیتمِ مرده
                  if (isStructural && kids.length === 0) return null;

                  return (
                    <li key={cat._id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategoryId(cat._id);
                          setExpandedCategoryId((prev) =>
                            kids.length > 0 && prev !== cat._id
                              ? cat._id
                              : null,
                          );
                        }}
                        aria-expanded={kids.length > 0 ? isExpanded : undefined}
                        className={`w-full text-right px-3 py-3 flex items-center gap-2 border-b border-white/[0.04] transition-colors ${
                          isActive
                            ? "bg-white/5 text-white font-medium border-r-2 border-r-[var(--color-primary)]"
                            : "text-gray-400 hover:text-white hover:bg-white/[0.03] border-r-2 border-r-transparent"
                        }`}
                      >
                        {cat.icon && (
                          <img
                            src={cat.icon}
                            alt=""
                            className="w-4 h-4 invert opacity-80 flex-shrink-0"
                          />
                        )}
                        <span className="min-w-0 flex-1 text-xs leading-tight truncate">
                          {cat.title}
                        </span>
                        {kids.length > 0 && (
                          <FiChevronLeft
                            size={14}
                            className={`flex-shrink-0 opacity-60 transition-transform ${
                              isExpanded ? "-rotate-90" : ""
                            }`}
                          />
                        )}
                      </button>

                      {kids.length > 0 && (
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <ul className="bg-black/15 py-1">
                              {kids.map((child) => (
                                <li key={child._id}>
                                  <Link
                                    href={withFilterForCategory(
                                      child,
                                      catalogPath(activeSport.slug, child.slug),
                                    )}
                                    onClick={onClose}
                                    className="mr-3 flex items-center gap-1.5 border-r border-white/10 px-3 py-2 text-right text-[11px] font-medium leading-5 text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-[var(--color-primary)]"
                                  >
                                    <span className="min-w-0 flex-1 truncate">
                                      {child.title}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-500 text-[12px] p-4 text-center">
                موردی یافت نشد
              </p>
            )}
          </div>

          {/* PANE B — دیتیل/برندها (در RTL سمت چپ) — ۶۰٪ */}
          <div className="w-[60%] flex-1 p-2 bg-black/20">
            {/* لینکِ مشاهده‌ی صفحه‌ی دسته‌ی فعال */}
            {activeCategory && (
              <Link
                href={withFilter(catalogPath(activeSport.slug, activeCategory.slug))}
                onClick={onClose}
                className="block px-2 py-2 mb-1 text-[11px] font-bold text-[var(--color-primary)] truncate"
              >
                مشاهده‌ی همه‌ی {activeCategory.title}
              </Link>
            )}

            {visibleBrands.length > 0 ? (
              visibleBrands.map((brand) => (
                <div key={brand._id} className="mb-2">
                  {/* برند = در کانتکستِ دسته → /[sport]/[category]/[brand] (الگوی ۵) */}
                  <Link
                    href={withFilter(
                      catalogPath(activeSport.slug, activeCategory.slug, brand.slug),
                    )}
                    onClick={onClose}
                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/5 transition-colors min-w-0"
                  >
                    {brand.icon && (
                      <div
                        style={iconMaskStyle(brand.icon)}
                        className="w-4 h-4 text-white opacity-80 flex-shrink-0"
                      />
                    )}
                    <span className="text-xs font-bold text-white truncate">
                      {brand.title}
                    </span>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-[12px] p-4 text-center">
                برندی یافت نشد
              </p>
            )}
          </div>
        </div>

        {/* ───────── بازار دست دوم — بلافاصله زیرِ بخشِ دسته‌ها و برندها ───────── */}
        {SECOND_HAND_ON && (
        <div className="border-t border-white/10 px-3 pb-6 pt-3">
          <Link
            href="/second-hand"
            onClick={onClose}
            className="flex min-h-[60px] items-center justify-between gap-2 px-4 py-4 rounded-[6px] bg-gradient-to-l from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 hover:border-[var(--color-primary)]/70 transition-all"
          >
            <span className="text-[var(--color-primary)] text-sm font-bold">جمعه بازار</span>
            <FiShoppingCart size={18} className="text-[var(--color-primary)]" />
          </Link>
        </div>
        )}
        </div>
      </motion.div>
    </>
  );
}

// ---- Main Navbar ----
export default function Navbar({ navData: initialNavData = [] }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // وضعیت کاربر از جزیره‌ی کلاینت (به‌جای prop سروری) خوانده می‌شود
  const { user } = useUser();

  const [cartCount, setCartCount] = useState(0);
  const [openCart, setOpenCart] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  // desktop: which panel is open — null, "all", or a top-level category id
  const [openMenu, setOpenMenu] = useState(null);
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const desktopMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const navData = Array.isArray(initialNavData) ? initialNavData : [];
  // انتخابِ مخاطبِ هدف — کاملاً کلاینتی، روی navData ی از پیش کش‌شده فیلتر می‌کند
  // (بدونِ round-trip یا کلیدِ کشِ تازه). null = «همه محصولات» (بدونِ فیلتر).
  const [selectedAudience, setSelectedAudience] = useState(null);
  const filteredNavData = filterNavDataByAudience(navData, selectedAudience);
  // مجموعه‌ی سراسریِ مخاطب‌هایی که دست‌کم یک محصول دارند — از روی audiences ی
  // از پیش‌محاسبه‌شده‌ی navbarService (بدون کوئریِ تازه)؛ برای پنهان‌کردنِ گزینه‌های
  // خالی در ستونِ دسکتاپ. عمداً از navData ی خام (نه فیلترشده) ساخته می‌شود تا با
  // انتخابِ یک مخاطب، گزینه‌های خواهر پنهان نشوند.
  const availableAudiences = collectAvailableAudiences(navData);
  // Without departments the catalog is one virtual root: its top-level categories
  // become navbar buttons (structural ones only while they still have children).
  const catalogRoot = DEPARTMENTS_ON ? null : filteredNavData[0] || null;
  const rootCategories = (catalogRoot?.categories || []).filter(
    (c) => !c.parent && (c.hasProducts !== false || catalogRoot.categories.some((k) => k.parent === c._id)),
  );
  const toggleMenu = (key) => setOpenMenu((open) => (open === key ? null : key));

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  // موبایل: باز بودن سرچ‌بارِ درون‌خطی (کل ردیف نوبار را موقتاً جایگزین می‌کند)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const debounceRef = useRef(null);

  const userDisplayName = getUserFullName(user, user?.userName || "");

 // تعداد آیتم‌ها همیشه از منبع واحد (getCart نرمال‌شده) خوانده می‌شود
 // تا بج دقیقاً با محتوای سبد یکسان بماند.
const updateCartCount = () => {
  setCartCount(getCartTotalQuantity());
};

// ۱. اجرای اولیه و گوش دادن به تغییرات سبد خرید
useEffect(() => {
  updateCartCount(); // خواندن مقدار اولیه هنگام لود صفحه

  // گوش دادن به رویدادهای سفارشی تغییر سبد در همان صفحه
  window.addEventListener("cart-changed", updateCartCount);
  window.addEventListener("cartchange", updateCartCount);

  // گوش دادن به رویداد استاندارد storage برای تغییرات در تب‌های دیگر
  window.addEventListener("storage", updateCartCount);

  return () => {
    window.removeEventListener("cart-changed", updateCartCount);
    window.removeEventListener("cartchange", updateCartCount);
    window.removeEventListener("storage", updateCartCount);
  };
}, []);

// ۲. این یوزافکت را هم برای زمانی که دراور باز/بسته می‌شود حفظ کنید (جهت اطمینان بیشتر)
useEffect(() => {
  updateCartCount();
}, [openCart]);

  useEffect(() => {
    const handler = (e) => {
      const isInsideSearch =
        desktopSearchRef.current?.contains(e.target) ||
        mobileSearchRef.current?.contains(e.target);

      if (!desktopMenuRef.current?.contains(e.target) && !mobileMenuRef.current?.contains(e.target)) setOpenMenu(null);
      if (!isInsideSearch) {
        setShowSearchDropdown(false);
        setIsDesktopSearchOpen(false);
        // کلیک بیرون از سرچ‌بار/دراپ‌داون → بستن سرچ‌بارِ موبایل هم
        setIsMobileSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  // React Compiler memoizes this; a manual useCallback made it bail out.
  const handleSearch = (value) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/compare/search?q=${encodeURIComponent(value)}`,
        );
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const closeSearch = () => {
    setShowSearchDropdown(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  useEffect(() => {
    setIsCategoryOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpenMenu(null);
      setIsDesktopSearchOpen(false);
      setShowSearchDropdown(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openDesktopSearch = () => {
    setIsDesktopSearchOpen(true);
    setOpenMenu(null);
    requestAnimationFrame(() => desktopSearchInputRef.current?.focus());
  };
  const closeDesktopSearch = () => {
    setIsDesktopSearchOpen(false);
    closeSearch();
  };

  const mobileActionButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-[6px] text-white transition-colors hover:bg-white/10 hover:text-[var(--color-primary)]";

  return (
    <>
      <nav
        onMouseLeave={() => setIsCategoryOpen(false)}
        className={`fixed top-0 right-0 left-0 z-50 bg-[#20232ae6] border-b border-white/10 lg:h-[75px] ${DEPARTMENTS_ON ? "h-[64px]" : "h-[104px]"}`}
      >
        {/* ===== DESKTOP ===== */}
        <div className="site-container hidden lg:block h-full">
          {/* Leaving the bar + its open panel (one area) closes the panel; the buttons still open it on click. */}
          <div ref={desktopMenuRef} onMouseLeave={() => setOpenMenu(null)} className="relative flex items-center justify-between h-full gap-6">
            <div className="flex items-center gap-5 h-full flex-shrink-0">
              <div className="origin-right flex-shrink-0">
                <Link href="/" prefetch={false}>
                  <Image
                    src={storeConfig.brand.logoLight || storeConfig.brand.logo}
                    loading="eager"
                    alt="logo"
                    width={160}
                    height={65}
                    className="w-auto h-[55px] object-contain transition-transform duration-300 hover:scale-105"
                  />
                </Link>
              </div>

              <div className={DEPARTMENTS_ON ? "relative" : ""}>
                <button
                  type="button"
                  aria-expanded={openMenu === "all"}
                  onClick={() => toggleMenu("all")}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-[var(--radius)] whitespace-nowrap text-sm hover:bg-[var(--color-primary)]/90 transition-all"
                >
                  <HiOutlineViewGrid size={18} />
                  <span>دسته‌بندی محصولات</span>
                </button>

                {DEPARTMENTS_ON && openMenu === "all" && navData.length > 0 && (
                  <CategoryMenu
                    navData={filteredNavData}
                    onClose={() => setOpenMenu(null)}
                    selectedAudience={selectedAudience}
                    onSelectAudience={setSelectedAudience}
                    availableAudiences={availableAudiences}
                  />
                )}
              </div>

              {/* top-level categories: each opens its own mega menu below the bar */}
              {rootCategories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  aria-expanded={openMenu === cat._id}
                  onClick={() => toggleMenu(cat._id)}
                  className={`relative h-full flex items-center px-1 text-sm whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-secondary)] after:transition-transform after:duration-300 ${openMenu === cat._id ? "text-white after:scale-x-100" : "text-gray-300 hover:text-white after:scale-x-0"}`}
                >
                  {cat.title}
                </button>
              ))}

              {NAVIGATION_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className="text-gray-300 hover:text-white transition-colors text-sm whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* User + Search + Cart */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {user ? (
                <Link href="/p-user">
                  <Button
                    className="flex items-center gap-1.5 rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    <FiUser size={15} />
                    <span>{user.name || "User"}</span>
                  </Button>
                </Link>
              ) : (
                <Link href="/login-register">
                  <Button
                    className="rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    ورود | ثبت‌نام
                  </Button>
                </Link>
              )}

              {user && BROADCASTS_ON && <UserNotificationBell />}

              {/* Search: an icon next to the cart that slides a field open */}
              <div ref={desktopSearchRef} className="relative flex items-center">
                <div
                  className={`overflow-hidden transition-all duration-500 ease-out ${isDesktopSearchOpen ? "w-72 opacity-100 ml-2" : "w-0 opacity-0"}`}
                >
                  <input
                    ref={desktopSearchInputRef}
                    type="search"
                    tabIndex={isDesktopSearchOpen ? 0 : -1}
                    placeholder="جستجو در محصولات..."
                    aria-label="جستجو در محصولات"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                    className="h-10 w-72 border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-gray-400 focus:border-white/60"
                  />
                </div>
                <IconButton
                  ariaLabel={isDesktopSearchOpen ? "بستن جستجو" : "جستجو"}
                  className="bg-transparent border-white hover:bg-white text-white hover:text-black transition-all"
                  variant="outline"
                  onClick={isDesktopSearchOpen ? closeDesktopSearch : openDesktopSearch}
                >
                  {isDesktopSearchOpen ? <FiX size={20} /> : <FiSearch size={20} />}
                </IconButton>

                {isDesktopSearchOpen && showSearchDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-[22rem] bg-[#20232af2] border border-white/10 rounded-[var(--radius)] shadow-2xl z-[200]">
                    {isSearching ? (
                      <p className="text-center text-gray-400 text-sm py-6">
                        در حال جستجو...
                      </p>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {searchResults.map((p) => (
                          <SearchResultItem
                            key={p._id}
                            product={p}
                            onClick={closeDesktopSearch}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 text-sm py-6">
                        محصولی یافت نشد
                      </p>
                    )}
                  </div>
                )}
              </div>

              {CART_ON && <div
                id="cart-nav-icon"
                className="relative cursor-pointer"
                onClick={() => setOpenCart(true)}
              >
                <IconButton
                  ariaLabel="سبد خرید"
                  className="bg-transparent border-white hover:bg-white text-white hover:text-black transition-all"
                  variant="outline"
                >
                  <FiShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[var(--color-primary)] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                      {cartCount}
                    </span>
                  )}
                </IconButton>
              </div>}
            </div>

            {!DEPARTMENTS_ON && catalogRoot && openMenu === "all" && (
              <AllCategoriesPanel
                sport={catalogRoot}
                roots={rootCategories}
                onClose={() => setOpenMenu(null)}
                selectedAudience={selectedAudience}
              />
            )}
            {!DEPARTMENTS_ON && catalogRoot && openMenu && openMenu !== "all" && (
              <RootCategoryPanel
                sport={catalogRoot}
                rootId={openMenu}
                onClose={() => setOpenMenu(null)}
                selectedAudience={selectedAudience}
                onSelectAudience={setSelectedAudience}
                availableAudiences={availableAudiences}
              />
            )}
          </div>
        </div>

        {/* ===== MOBILE ===== */}
        <div ref={mobileMenuRef} className="site-container lg:hidden relative flex h-full flex-col">
          <div className="flex h-[64px] shrink-0 items-center">
          {isMobileSearchOpen ? (
            /* حالت جستجو: سرچ‌بار درون‌خطی جایگزین کل ردیف نوبار می‌شود — از سمت آیکون باز می‌شود */
            <motion.div
              key="mobile-search"
              ref={mobileSearchRef}
              initial={{ opacity: 0, clipPath: "inset(0 0 0 100%)" }}
              animate={{ opacity: 1, clipPath: "inset(0 0 0 0%)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full"
            >
              <FiSearch
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55"
              />
              <input
                type="search"
                autoFocus
                placeholder="جستجو در محصولات..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() =>
                  searchQuery.length >= 2 && setShowSearchDropdown(true)
                }
                className="h-10 w-full rounded-[var(--radius)] border border-white/10 bg-white/[0.06] pr-10 pl-11 text-sm text-white placeholder:text-gray-400/80 outline-none transition-colors focus:border-[var(--color-primary)]/50 focus:bg-white/[0.09]"
              />
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  closeSearch();
                }}
                aria-label="بستن جستجو"
                className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FiX size={20} />
              </button>
              {showSearchDropdown && (
                <div className="absolute top-full right-0 left-0 mt-2 bg-[#20232ae6] border border-white/10 rounded-[var(--radius)] shadow-2xl z-[200] max-h-[60vh] overflow-y-auto">
                  {isSearching ? (
                    <p className="text-center text-gray-400 text-sm py-5">
                      در حال جستجو...
                    </p>
                  ) : searchResults.length > 0 ? (
                    <div className="p-2 space-y-0.5">
                      {searchResults.map((p) => (
                        <SearchResultItem
                          key={p._id}
                          product={p}
                          onClick={() => {
                            closeSearch();
                            setIsMobileSearchOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-sm py-5">
                      محصولی یافت نشد
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
          <div className="flex min-h-[45px] items-center justify-between w-full">
            {/* سمت راست: دسته‌بندی محصولات و لوگو */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {DEPARTMENTS_ON && (
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                aria-label="دسته‌بندی محصولات"
                className="flex h-9 w-9 items-center justify-center rounded-[6px] text-white transition-colors hover:bg-white/10"
              >
                {isCategoryOpen ? (
                  <FiX size={24} />
                ) : (
                  <HiOutlineViewGrid size={24} />
                )}
              </button>
              )}
              <Link href="/" prefetch={false} className="flex-shrink-0">
                <Image
                  src={storeConfig.brand.logoLight || storeConfig.brand.logo}
                  loading="eager"
                  alt="logo"
                  width={100}
                  height={45}
                  className="w-auto h-[45px] object-contain"
                />
              </Link>
            </div>

            {/* سمت چپ: جستجو، داشبورد کاربر و سبد خرید */}
            <div className="flex items-center justify-start gap-1.5 flex-shrink-0">
              {user ? (
                <Link href="/p-user">
                  <Button
                    className="flex items-center gap-1.5 rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    <FiUser size={15} />
                    <span className="max-w-[82px] truncate">
                      {user.name || "\u062f\u0627\u0634\u0628\u0648\u0631\u062f"}
                    </span>
                  </Button>
                </Link>
              ) : (
                <Link href="/login-register">
                  <Button
                    className="rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    ورود | ثبت‌نام
                  </Button>
                </Link>
              )}

              <button
                type="button"
                className={mobileActionButtonClass}
                onClick={() => { setIsMobileSearchOpen(true); setOpenMenu(null); }}
                aria-label="جستجو"
              >
                <FiSearch size={21} className="text-white" />
              </button>

              {CART_ON && <button
                type="button"
                className={`${mobileActionButtonClass} relative cursor-pointer`}
                onClick={() => setOpenCart(true)}
                aria-label="سبد خرید"
              >
                <FiShoppingCart size={21} className="text-white" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-primary)] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>}
            </div>
          </div>
          )}
          </div>

          {/* ردیفِ دوم: دسته‌بندی‌ها و دسته‌های سطحِ اول، با اسکرولِ افقی */}
          {!DEPARTMENTS_ON && catalogRoot && (
            <div className="no-scrollbar -mx-3 flex h-10 shrink-0 items-stretch gap-4 overflow-x-auto px-3">
              <button
                type="button"
                aria-expanded={openMenu === "all"}
                onClick={() => toggleMenu("all")}
                className={`relative flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-secondary)] after:transition-transform after:duration-300 ${openMenu === "all" ? "text-white after:scale-x-100" : "text-gray-300 after:scale-x-0"}`}
              >
                <HiOutlineViewGrid size={16} />
                دسته‌بندی‌ها
              </button>
              {rootCategories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  aria-expanded={openMenu === cat._id}
                  onClick={() => toggleMenu(cat._id)}
                  className={`relative flex shrink-0 items-center text-[13px] whitespace-nowrap after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-secondary)] after:transition-transform after:duration-300 ${openMenu === cat._id ? "text-white after:scale-x-100" : "text-gray-300 after:scale-x-0"}`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          )}

          {!DEPARTMENTS_ON && catalogRoot && openMenu && (
            <div dir="rtl" className="absolute top-full inset-x-0 z-[100] max-h-[calc(100vh-104px)] overflow-y-auto border-b border-white/10 bg-[#20232af2] text-right shadow-2xl backdrop-blur">
              {openMenu === "all" ? (
                <AllCategoriesPanel
                  inline
                  sport={catalogRoot}
                  roots={rootCategories}
                  onClose={() => setOpenMenu(null)}
                  selectedAudience={selectedAudience}
                />
              ) : (
                <MobileRootPanel
                  sport={catalogRoot}
                  rootId={openMenu}
                  onClose={() => setOpenMenu(null)}
                  selectedAudience={selectedAudience}
                />
              )}
            </div>
          )}

          {/* منوی کشویی چندسطحی موبایل (با باز/بسته شدن دوباره، به سطح ۱ ریست می‌شود) */}
          <AnimatePresence>
            {isCategoryOpen && (
              <MobileCategoryDrawer
                key="mobile-cat-drawer"
                navData={filteredNavData}
                onClose={() => setIsCategoryOpen(false)}
                selectedAudience={selectedAudience}
                onSelectAudience={setSelectedAudience}
                availableAudiences={availableAudiences}
              />
            )}
          </AnimatePresence>
        </div>
      </nav>

      {!isHomePage && <div className={`lg:h-[75px] ${DEPARTMENTS_ON ? "h-[64px]" : "h-[104px]"}`} />}
      {CART_ON && <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />}
    </>
  );
}
