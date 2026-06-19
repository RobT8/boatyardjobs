"use client";

import { Children, useRef, type ReactNode } from "react";

/** Horizontal, scroll-snapping carousel with prev/next buttons. Children are
 * rendered server-side (e.g. JobCards) and each gets a fixed width here. */
export default function FeaturedCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div className="w-80 shrink-0 snap-start">{child}</div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => scroll(-1)}
        className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-800 shadow hover:bg-slate-50 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scroll(1)}
        className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-800 shadow hover:bg-slate-50 sm:flex"
      >
        ›
      </button>
    </div>
  );
}
