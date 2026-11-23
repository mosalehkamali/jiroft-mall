"use client";

import { useState } from "react";

export default function TopBanner({ banner, height }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <aside aria-label="بنر فروشگاه" className={`relative w-full overflow-hidden ${height}`}>
      <a href={banner.href} className="block size-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner.image} alt="مشاهده صفحه معرفی‌شده در بنر" className="size-full object-cover" onError={() => setClosed(true)} />
      </a>
      <button type="button" aria-label="بستن بنر" onClick={() => setClosed(true)}
        className="absolute end-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-2xl text-white focus-visible:outline-2">
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
