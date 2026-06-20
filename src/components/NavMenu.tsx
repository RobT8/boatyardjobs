"use client";

import Link from "next/link";
import { useState } from "react";

/** A header nav item with a click-to-open dropdown of sub-links. */
export default function NavMenu({
  label,
  links,
}: {
  label: string;
  links: [string, string][];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
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
        <>
          {/* click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {links.map(([linkLabel, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-navy-800 hover:bg-navy-50"
              >
                {linkLabel}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
