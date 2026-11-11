"use client";

import { createContext, useRef, useState } from "react";
import { FiChevronDown, FiRotateCcw, FiSearch, FiSliders, FiX } from "react-icons/fi";

/**
 * The bar above every product listing: a «فیلترها» button and a search button,
 * with the product count at the far end.
 *
 *  - Search: an icon button that opens the search box in place (it stays open
 *    while it holds text).
 *  - Filters: an accordion under the bar, so the product grid keeps the whole
 *    page width. `children` is the page's existing filter content.
 *
 * Every filter source is wrapped in MobileFilterDrawer, which already knows the
 * active-filter count and the reset action. Inside this panel the drawer renders
 * its children as they are and reports those two values here (FilterPanelContext),
 * so the button can show the count and the panel can offer «حذف فیلترها».
 */
export const FilterPanelContext = createContext(null);

export default function ListingToolbar({ children, search, onSearchChange, searchPlaceholder = "جستجوی نام محصول یا برند...", count, countNote = null }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(search));
  const [activeCount, setActiveCount] = useState(0);
  const resetRef = useRef(null);
  const [panel] = useState(() => ({
    report(count, onReset) {
      resetRef.current = onReset;
      setActiveCount(count || 0);
    },
  }));

  const button = "inline-flex h-10 items-center gap-2 border border-gray-200 bg-white px-3 text-sm text-gray-800 transition-colors hover:border-gray-900";

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5">
        {children ? (
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="listing-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`${button} ${filtersOpen ? "border-gray-900" : ""}`}
          >
            <FiSliders size={15} />
            <span>فیلترها</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center bg-[var(--color-primary)] px-1 text-[11px] text-white">
                {activeCount.toLocaleString("fa-IR")}
              </span>
            )}
            <FiChevronDown size={14} className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
        ) : null}

        {onSearchChange ? (
          searchOpen ? (
            <div className="relative flex h-10 w-full max-w-sm items-center border border-gray-900 bg-white">
              <FiSearch size={15} className="pointer-events-none absolute right-3 text-gray-400" />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape" && !search) setSearchOpen(false); }}
                placeholder={searchPlaceholder}
                aria-label="جستجو"
                className="h-full w-full bg-transparent pl-9 pr-9 text-sm outline-none"
              />
              <button
                type="button"
                aria-label="بستن جستجو"
                onClick={() => { onSearchChange(""); setSearchOpen(false); }}
                className="absolute left-2 p-1 text-gray-500 hover:text-gray-900"
              >
                <FiX size={15} />
              </button>
            </div>
          ) : (
            <button type="button" aria-label="جستجو" title="جستجو" onClick={() => setSearchOpen(true)} className={`${button} w-10 justify-center px-0`}>
              <FiSearch size={16} />
            </button>
          )
        ) : null}

        {count != null && (
          <span className="ms-auto whitespace-nowrap text-xs text-gray-500">
            {typeof count === "number" ? count.toLocaleString("fa-IR") : count} کالا
            {countNote}
          </span>
        )}
      </div>

      {children ? (
        <div
          id="listing-filters"
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div inert={!filtersOpen} className="mt-1.5 border border-gray-200 bg-white p-4">
              <FilterPanelContext.Provider value={panel}>{children}</FilterPanelContext.Provider>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => resetRef.current?.()}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900"
                >
                  <FiRotateCcw size={12} /> حذف فیلترها
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
