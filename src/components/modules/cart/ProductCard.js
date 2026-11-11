"use client";

import storeConfig from "base/store.config";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiEye, FiHeart, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { valueImageSwatches } from "@/lib/variantImages";
import useWishlist from "@/hooks/useWishlist";

const LABELS = { new: "جدید", limited: "محدود", hot: "پرفروش" };
// Ticket shape: flush with the card's right edge, notched on the left.
const TAG = "py-0.5 pr-2 pl-4 text-[10px] font-medium leading-4 text-white bg-[var(--color-primary)] [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)]";
const ICON_BUTTON =
  "inline-flex h-7 w-7 items-center justify-center bg-white/90 text-[14px] text-gray-800 transition-colors hover:text-[var(--color-primary)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";
const ARROW =
  "absolute top-1/2 z-20 hidden h-8 w-6 -translate-y-1/2 items-center justify-center text-[18px] text-gray-800 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 lg:flex";

/**
 * Minimal product card: the photo, then name and price. The whole card links to
 * the product. Quick view and wishlist sit on the photo (always on touch
 * screens, on hover from `lg` up). A product whose variants carry images turns
 * the photo into a slider: swipe on touch, arrows on hover, and one automatic
 * step when the pointer enters the card.
 */
export default function ProductCard({ product, rate, onQuickView, onQuickViewIntent, overlay = null, campaignBadge = null }) {
  const { mainImage, name, slug, basePrice, label } = product;
  const { isWishlisted, toggle: toggleWishlist, isLoading: wishlistLoading } = useWishlist(product);
  const href = `/products/${slug}`;
  const currency = storeConfig.commerce.currency.label;

  // Prices come from the server (attachListingPrices); the local fallback only covers a missing value.
  const basePriceToman = product.basePriceToman != null
    ? product.basePriceToman
    : Math.floor(Math.round(Number(basePrice) * (rate || 1)) / 1000) * 1000;
  const finalPriceToman = product.finalPriceToman != null ? product.finalPriceToman : basePriceToman;
  const discountPercent = product.discountPercent ?? 0;
  const hasDiscount = finalPriceToman < basePriceToman;

  // Slides: the main image, then variant images — value-level (variantMeta) first, variant-level as the fallback.
  const metaImages = valueImageSwatches(product).map((s) => s.image);
  const variantImages = metaImages.length
    ? metaImages
    : (product.variants || []).map((v) => Array.isArray(v?.images) && v.images[0]);
  const images = [...new Set([mainImage, ...variantImages].filter(Boolean))];
  const isSlider = images.length > 1;

  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const go = (next) => {
    const el = scroller.current;
    if (!el) return;
    const target = (next + images.length) % images.length;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };
  const hoverCapable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  return (
    <div
      className="group relative flex h-full flex-col"
      onMouseEnter={() => { if (isSlider && index === 0 && hoverCapable()) go(1); }}
      onMouseLeave={() => { if (isSlider && hoverCapable()) go(0); }}
    >
      {/* optional decoration layer (event ribbon / sticker) */}
      {overlay}

      <div className="relative aspect-[3/4] overflow-hidden bg-[#f4f4f4]">
        {/* direction:ltr so slide n sits at scrollLeft = n × width (the document is RTL) */}
        <div
          ref={scroller}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}
          // overflow-y-hidden: the hover zoom must never make the strip scroll vertically.
          // With a mouse the strip is not user-scrollable at all (the wheel goes to the page;
          // the arrows still move it — scrollTo works on overflow:hidden); touch keeps its swipe.
          className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [direction:ltr] [@media(hover:hover)]:overflow-x-hidden"
        >
          {images.map((src, i) => (
            <Link
              key={src}
              href={href}
              aria-label={i === 0 ? name : undefined}
              aria-hidden={i === 0 ? undefined : true}
              tabIndex={i === 0 ? undefined : -1}
              className="relative h-full w-full shrink-0 snap-start overflow-hidden"
            >
              <Image src={src} alt={i === 0 ? name : ""} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="card-zoom object-cover" />
            </Link>
          ))}
        </div>

        {/* tags — one colour for all of them */}
        <div dir="rtl" className="pointer-events-none absolute right-0 top-2 z-20 flex flex-col items-start gap-1">
          {campaignBadge?.text && (
            <span className={TAG} style={{ background: campaignBadge.bgColor || undefined, color: campaignBadge.textColor || undefined }}>
              {campaignBadge.text}
            </span>
          )}
          {hasDiscount && discountPercent > 0 && <span className={TAG}>{discountPercent.toLocaleString("fa-IR")}٪</span>}
          {product.hasQuantityDiscount && <span className={TAG}>ویژه</span>}
          {LABELS[label] && <span className={TAG}>{LABELS[label]}</span>}
        </div>

        {/* actions — always visible on touch screens; from lg up they slide in from the left on hover */}
        <div className="absolute left-2 top-2 z-20 flex flex-col gap-1 transition duration-300 ease-out lg:-translate-x-[150%] lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:focus-within:translate-x-0 lg:focus-within:opacity-100">
          {onQuickView && (
            <button
              type="button"
              aria-label="نمایش سریع"
              title="نمایش سریع"
              onPointerEnter={onQuickViewIntent}
              onFocus={onQuickViewIntent}
              onPointerDown={onQuickViewIntent}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(); }}
              className={ICON_BUTTON}
            >
              <FiEye />
            </button>
          )}
          <button
            type="button"
            aria-label={isWishlisted ? "حذف از لیست" : "افزودن به علاقه مندی"}
            title={isWishlisted ? "حذف از لیست" : "افزودن به علاقه مندی"}
            disabled={wishlistLoading}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(); }}
            className={ICON_BUTTON}
          >
            <FiHeart fill={isWishlisted ? "currentColor" : "none"} className={isWishlisted ? "text-[var(--color-primary)]" : ""} />
          </button>
        </div>

        {isSlider && (
          <>
            <button type="button" aria-label="تصویر قبلی" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(index - 1); }} className={`${ARROW} left-1`}><FiChevronLeft /></button>
            <button type="button" aria-label="تصویر بعدی" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(index + 1); }} className={`${ARROW} right-1`}><FiChevronRight /></button>
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1 [direction:ltr]">
              {images.map((src, i) => (
                <span key={src} className={`h-px w-3 ${i === index ? "bg-gray-900" : "bg-gray-900/25"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <Link href={href} tabIndex={-1} className="block pt-2.5 text-right">
        <h3 className="truncate text-[14px] font-normal leading-6 text-gray-800" title={name}>{name}</h3>
        {/* each number is its own flex item: adjacent digit runs would otherwise be reordered by bidi */}
        <p className="flex items-baseline gap-1 text-[14px] leading-6 text-gray-900">
          <span>{finalPriceToman.toLocaleString("fa-IR")}</span>
          <span className="text-[10px] text-gray-500">{currency}</span>
          {hasDiscount && (
            <>
              <span className="mr-2 text-gray-400 line-through">{basePriceToman.toLocaleString("fa-IR")}</span>
              <span className="text-[10px] text-gray-400">{currency}</span>
            </>
          )}
        </p>
      </Link>
    </div>
  );
}
