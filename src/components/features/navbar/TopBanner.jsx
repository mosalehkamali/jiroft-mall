"use client";

import { useState } from "react";

// The image keeps its own aspect ratio, so phones see the whole banner instead of a cropped middle.
export default function TopBanner({ banner }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <aside aria-label="بنر فروشگاه" className="relative w-full overflow-hidden">
      <a href={banner.href} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner.image} alt="مشاهده صفحه معرفی‌شده در بنر" className="block h-auto w-full" onError={() => setClosed(true)} />
      </a>
      <button type="button" aria-label="بستن بنر" onClick={() => setClosed(true)}
        className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-lg text-white focus-visible:outline-2 md:size-11 md:text-2xl">
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
