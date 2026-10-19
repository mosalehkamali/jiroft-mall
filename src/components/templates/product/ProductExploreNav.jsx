import Link from "next/link";
import { ArrowLeft, Compass, Layers3, Tag, SlidersHorizontal } from "lucide-react";
import { getCategoryLabel } from "base/utils/categoryLabel";
import styles from "./ProductExploreNav.module.css";
import storeConfig from "base/store.config";
import { isFeatureEnabled } from "@/lib/features";

const titleOf = (entity) => (entity?.title || entity?.name || "").trim();
// سطحِ خالی (دپارتمانِ خاموش، دسته‌ی ریشه، برندِ خاموش) از مسیر حذف می‌شود.
const pathOf = (...entities) => {
  const present = entities.filter(Boolean);
  return present.length && present.every((entity) => entity?.slug && titleOf(entity))
    ? `/${present.map((entity) => encodeURIComponent(entity.slug)).join("/")}`
    : null;
};

export default function ProductExploreNav({ product }) {
  const sport = isFeatureEnabled("departments") ? product.sport : null;
  const brand = isFeatureEnabled("brands") ? product.brand : null;
  const { category } = product;
  // دسته‌ی بدونِ دپارتمان در ریشه است: /[category]
  const categorySport = category?.sport ? sport : null;
  const categoryLabel = getCategoryLabel({ ...category, sport: categorySport });
  const links = [
    { key: "sport", hint: storeConfig.catalog.departmentLabel, label: titleOf(sport), href: sport ? pathOf(sport) : null, Icon: Compass },
    { key: "category", hint: "دسته‌بندی", label: categoryLabel, href: category ? pathOf(categorySport, category) : null, Icon: Layers3 },
    { key: "brand", hint: "برند", label: titleOf(brand), href: brand ? pathOf(brand) : null, Icon: Tag },
    {
      key: "collection",
      hint: "بیشتر ببینید",
      label: `${categoryLabel} ${titleOf(brand)}`.trim(),
      href: category && brand ? pathOf(categorySport, category, brand) : null,
      Icon: SlidersHorizontal,
    },
  ].filter((link) => link.href);

  if (!links.length) return null;

  return (
    <nav className={styles.nav} aria-label="کاوش محصولات مرتبط" dir="rtl">
      <ul className={styles.list}>
        {links.map(({ key, hint, label, href, Icon }) => (
          <li key={key} className={styles.item}>
            <Link
              href={href}
              className={`${styles.link} ${key === "collection" ? styles.collection : ""}`}
            >
              <Icon className={styles.icon} size={17} strokeWidth={1.6} aria-hidden="true" />
              <span className={styles.copy}>
                <span className={styles.hint}>{hint}</span>
                <span className={styles.label}>{label}</span>
              </span>
              <ArrowLeft className={styles.arrow} size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
