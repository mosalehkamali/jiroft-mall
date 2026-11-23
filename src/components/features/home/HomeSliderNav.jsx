import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

/**
 * دکمه‌های عقب/جلوی اسلایدرهای صفحه‌ی اصلی.
 *
 * عیناً همان مارک‌آپی است که در BestSellers بود؛ اینجا آمد تا بلوکِ ادغام‌شده‌ی
 * مقاله هم *همان* دکمه‌ها را داشته باشد، نه یک کپیِ شبیه. صفحه‌ی اصلی با
 * کلاس‌های هوک به Swiper وصل می‌شود (prevClass/nextClass) و جای دیگر با
 * onPrev/onNext — خروجیِ رندر در هر دو حالت یکی است.
 *
 * prevDisabled/nextDisabled فقط جایی استفاده می‌شود که خودمان ابتدا/انتها را
 * می‌دانیم؛ صفحه‌ی اصلی آن‌ها را نمی‌فرستد، پس خروجی‌اش بدونِ تغییر است.
 */
export default function HomeSliderNav({
  prevClass = "",
  nextClass = "",
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  className = "hidden md:flex items-center mt-8 md:mt-0",
  sideControls = false,
  label,
}) {
  const button = sideControls ? "product-slider-arrow" : "w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all rounded-lg disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className={sideControls ? "pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2" : className} {...(label ? { role: "group", "aria-label": label } : null)}>
      <div dir="rtl" className={sideControls ? "flex justify-between" : "flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-xl p-1 border border-white/50"}>
        <button type="button" className={`${prevClass} ${button}`.trim()} onClick={onPrev} disabled={prevDisabled} aria-label="قبلی">
          <FiArrowRight size={22} />
        </button>

        {!sideControls && <div className="w-[1px] h-6 bg-gray-100 self-center mx-1" />}

        <button type="button" className={`${nextClass} ${button}`.trim()} onClick={onNext} disabled={nextDisabled} aria-label="بعدی">
          <FiArrowLeft size={22} />
        </button>
      </div>
    </div>
  );
}
