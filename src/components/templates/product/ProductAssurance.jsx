import storeConfig from "base/store.config";
import { ShieldCheck, RotateCcw, CreditCard, Truck, Store, Headphones, BadgeCheck, Gift } from "lucide-react";
import { isFeatureEnabled } from "@/lib/features";

// store.config.js → productPage.assurances: [{ icon, label, feature? }]
const ICONS = {
  shield: ShieldCheck,
  return: RotateCcw,
  card: CreditCard,
  truck: Truck,
  store: Store,
  support: Headphones,
  badge: BadgeCheck,
  gift: Gift,
};

const assurances = (storeConfig.productPage?.assurances || []).filter(
  (item) => item?.label && (!item.feature || isFeatureEnabled(item.feature)),
);

export default function ProductAssurance() {
  if (!assurances.length) return null;
  return (
    <ul
      aria-label={`مزایای خرید از ${storeConfig.brand.name}`}
      dir="rtl"
      className="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-gray-100 bg-gray-100 p-0 md:grid-cols-4"
    >
      {assurances.map(({ icon, label }) => {
        const Icon = ICONS[icon] || BadgeCheck;
        return (
          <li
            key={label}
            className="flex min-w-0 items-center justify-start gap-1.5 bg-white px-2 py-2.5 sm:gap-2 sm:px-4 md:justify-center"
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-8 shrink-0 text-[var(--color-primary)] sm:size-10" />
            <span className="min-w-0 text-xs leading-6 font-medium text-gray-700">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
