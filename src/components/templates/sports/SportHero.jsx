/**
 * The shared page header (category/brand/serie listings, /products, second-hand,
 * athletes, CMS pages, the article «هدر» block): the page title in the primary
 * colour with a short secondary-colour line under it. No image.
 *
 * props:
 *  - title: the h1 text
 *  - headerExtra: optional slot under the line (campaign countdown, active filters)
 *  - image / alt: still accepted from callers but no longer drawn
 */
export default function SportHero({ title, headerExtra = null }) {
  return (
    <div className="site-container flex flex-col items-center pt-8 text-center md:pt-12">
      {/* On a campaign page --event-text is the event's title colour; elsewhere the primary colour. */}
      <h1
        className="mb-3 text-2xl font-bold md:text-4xl"
        style={{ color: "var(--event-text, var(--color-primary))" }}
      >
        {title}
      </h1>

      <div className="h-1 w-20 bg-[var(--color-secondary)]" />

      {headerExtra ? <div className="mt-4">{headerExtra}</div> : null}
    </div>
  );
}
