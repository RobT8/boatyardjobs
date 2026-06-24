"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * A dropdown item: a `[label, href]` link, or a `{label, action}` form button
 * that POSTs to `action` (used for sign-out).
 */
export type MenuItem = [string, string] | { label: string; action: string };

/**
 * A header nav item whose dropdown opens on mouse hover *and* on click/tap.
 * Hover is mouse-only (via pointer type) so touch devices fall back to a clean
 * tap-to-toggle; a short close delay bridges the gap between the button and the
 * panel, and an outside pointer-down closes it.
 */
export default function NavMenu({
  label,
  links,
}: {
  label: string;
  links: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  // Close when pointing/clicking anywhere outside this menu (touch + click).
  useEffect(() => {
    if (!open) return;
    function onDown(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Tidy up a pending close timer on unmount.
  useEffect(() => cancelClose, []);

  return (
    <div
      ref={ref}
      className="static sm:relative"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") openNow();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") closeSoon();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 hover:text-brass-400"
      >
        {label}
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0">
          {links.map((item) =>
            Array.isArray(item) ? (
              <Link
                key={item[1]}
                href={item[1]}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-navy-800 transition-colors hover:bg-navy-700 hover:text-white focus:bg-navy-700 focus:text-white focus:outline-none"
              >
                {item[0]}
              </Link>
            ) : (
              // No onClick close: closing here unmounts the form before it can
              // submit. The POST redirects and reloads the page anyway.
              <form key={item.action} action={item.action} method="post">
                <button
                  type="submit"
                  className="block w-full px-4 py-2 text-left text-sm text-navy-800 transition-colors hover:bg-navy-700 hover:text-white focus:bg-navy-700 focus:text-white focus:outline-none"
                >
                  {item.label}
                </button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}
