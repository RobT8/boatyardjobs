"use client";

import { Children, useEffect, useRef, type ReactNode } from "react";

const STEP = 336; // card width (w-80 = 320px) + gap-4 (16px)
const INTERVAL = 3500; // auto-advance every 3.5s
const MANUAL_PAUSE = 6000; // pause auto-scroll for 6s after a manual nudge

/** Auto-scrolling, scroll-snapping carousel. Advances on its own, loops back at
 * the end, pauses on hover/touch, and still supports the prev/next arrows. */
export default function FeaturedCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);
  const cooldownRef = useRef(0);

  const nudge = (dir: number) => {
    cooldownRef.current = Date.now() + MANUAL_PAUSE;
    ref.current?.scrollBy({ left: dir * STEP, behavior: "smooth" });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      if (hoveringRef.current || Date.now() < cooldownRef.current) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + STEP, behavior: "smooth" });
    }, INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => (hoveringRef.current = true)}
      onMouseLeave={() => (hoveringRef.current = false)}
      onTouchStart={() => {
        cooldownRef.current = Date.now() + MANUAL_PAUSE;
      }}
    >
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
        onClick={() => nudge(-1)}
        className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-800 shadow hover:bg-slate-50 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => nudge(1)}
        className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-800 shadow hover:bg-slate-50 sm:flex"
      >
        ›
      </button>
    </div>
  );
}
