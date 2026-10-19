import Link from "next/link";
import storeConfig from "base/store.config";
import { isFeatureEnabled } from "@/lib/features";

/**
 * Shown instead of "add to cart" when the store's rules say this product can't
 * be bought online (see src/lib/productRules.js → purchaseStatus):
 *   inquiry  → "contact us" call-to-action (store.config.js commerce.purchase)
 *   catalog  → showcase only
 *   soldOut  → out of stock
 *   other    → not available right now (e.g. no price yet)
 */
export default function PurchaseUnavailable({ purchase }) {
  const { contact = {} } = storeConfig.brand;
  const box = "flex flex-col gap-2 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm";

  if (purchase?.mode === "inquiry") {
    const href = contact.whatsapp
      ? `https://wa.me/${contact.whatsapp}`
      : contact.phone
        ? `tel:${contact.phone}`
        : isFeatureEnabled("contactForm")
          ? "/contact"
          : null;
    return (
      <div className={box}>
        <span className="font-bold text-[var(--color-text)]">{storeConfig.commerce.purchase.inquiryText}</span>
        {href ? (
          <Link
            href={href}
            className="inline-flex h-11 items-center justify-center rounded-[6px] bg-[var(--color-primary)] px-6 font-bold text-white hover:bg-[var(--color-primary-dark)]"
          >
            استعلام و سفارش
          </Link>
        ) : null}
      </div>
    );
  }

  if (purchase?.mode === "catalog") return null;

  return (
    <div className={box}>
      <span className="font-bold text-[var(--color-muted)]">
        {purchase?.soldOut ? "ناموجود" : "این محصول در حال حاضر قابل خرید نیست"}
      </span>
    </div>
  );
}
