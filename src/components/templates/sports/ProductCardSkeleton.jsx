"use client";

/**
 * اسکلتونِ کارت محصول — هم‌شکلِ `@/components/modules/cart/ProductCard`
 * (تصویرِ ۳:۴، سپس نام و قیمت) تا جایگزینی با محتوای واقعی پرشی نداشته باشد.
 *
 * تمِ روشن (کارتِ سفید + بلوک‌های خاکستریِ روشن) — هم‌خوان با تمِ روشنِ صفحه‌ی برند.
 * انیمیشن: همان sweepِ چپ‌به‌راستِ سراسری (@keyframes shimmer) با احترام به
 * prefers-reduced-motion.
 */

// بلوکِ خاکستری با درخششِ روان (light sweep). از همان keyframe سراسریِ shimmer
// استفاده می‌کند که در globals.css تعریف شده.
function Shimmer({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-[shimmer_1.5s_infinite] motion-reduce:animate-none" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Shimmer className="w-full aspect-[3/4]" />
      <div className="flex flex-col items-start gap-2 pt-3">
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/**
 * شبکه‌ی اسکلتون: دقیقاً همان grid کارت‌های واقعی (۲ ستون موبایل / ۳ تبلت / ۴ دسکتاپ)
 * با ۸ کارت = دو ردیفِ کامل در دسکتاپ.
 */
export default function ProductGridSkeleton({ count = 8 }) {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
