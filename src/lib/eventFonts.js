/**
 * The fonts available to events.
 *
 * Each `value` is a font-family that is ALREADY registered:
 *  - Vazirmatn  → loaded from local WOFF2 files via globals.css
 *  - the rest   → declared as @font-face in src/app/globals.css (files in /public/fonts)
 *
 * globals.css is imported by both the (Site) and (Admin-Panel) layouts, so any
 * family listed here renders correctly on the public event page and in the admin preview.
 *
 * To add a new font: drop the file in /public/fonts, add an @font-face block in
 * globals.css, then add an entry here. Nothing else needs to change.
 */
export const EVENT_FONTS = [
  { value: "Vazirmatn", label: "وزیر متن", sample: "نمونه متن فارسی Aa" },
  { value: "Lalezar", label: "لاله‌زار", sample: "نمونه متن فارسی Aa" },
];

export const DEFAULT_FONT = "Vazirmatn";
