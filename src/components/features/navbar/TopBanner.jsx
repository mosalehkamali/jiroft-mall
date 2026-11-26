"use client";

import { useState } from "react";

// The image keeps its own aspect ratio (never cropped). Phones (<768px, Tailwind's md) get the mobile image when one is set.
export default function TopBanner({ banner }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <aside aria-label="بنر فروشگاه" className="relative w-full overflow-hidden">
      <a href={banner.href} className="block">
        <picture>
          {banner.mobileImage && <source media="(max-width: 767px)" srcSet={banner.mobileImage} />}
          <img src={banner.image} alt="مشاهده صفحه معرفی‌شده در بنر" className="block h-auto w-full" onError={() => setClosed(true)} />
        </picture>
      </a>
      <button type="button" aria-label="بستن بنر" onClick={() => setClosed(true)}
        className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-lg text-white focus-visible:outline-2 md:size-11 md:text-2xl">
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
