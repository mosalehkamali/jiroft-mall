import storeConfig from "base/store.config";
import { getActiveEvents } from "base/services/event.service";
import EventCard from "@/components/features/events/EventCard";
import Link from "next/link";

// رویدادها با تگ‌های events/limited-editions کش و در تغییرِ ادمین باطل می‌شوند؛
// TTL زمان‌محور → ۱ساعت برای کاهشِ ISR Writes.
export const revalidate = 3600;

export const metadata = {
  title: `کالکشن‌ها و کمپین‌های ${storeConfig.brand.name}`,
  description: `آخرین Collectionهای ${storeConfig.brand.name} — فروش ویژه، Collectionهای فصلی و تجربه‌های منحصر‌به‌فرد`,
  alternates: { canonical: "/collection" },
};

export default async function EventsPage() {
  const events = await getActiveEvents();

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #080808 0%, #111111 100%)" }}
      dir="rtl"
    >
      {/* Hero header */}
      <section className="relative overflow-hidden pt-24 pb-16 px-6">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="site-container relative z-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-primary)] mb-4">
            {storeConfig.brand.nameEn.toUpperCase()} Collection
          </p>
          <h1
            className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight"
            style={{ fontFamily: "'Lalezar', 'Vazirmatn', sans-serif" }}
          >
            Collection
          </h1>
          <p className="text-sm text-white/50 max-w-xl mx-auto leading-7">
            تجربه‌های خرید منحصربه‌فرد با هویت بصری مستقل — هر Collection دنیایی جداگانه است
          </p>
        </div>
      </section>

      {/* Events grid */}
      <section className="site-container pb-6 md:pb-8">
        {events.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4" aria-hidden="true">🎪</div>
            <p className="text-white/30 font-bold text-sm">
              در حال حاضر Collection فعالی وجود ندارد
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white border border-white/10 hover:border-[var(--color-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-text)]"
            >
              بازگشت به فروشگاه
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {events.map((event, i) => (
              <EventCard key={event._id} event={event} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
