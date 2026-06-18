"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS: [string, string][] = [
  ["Why post here", "/employers"],
  ["Post a job", "/post-a-job"],
  ["My listings", "/employers/dashboard"],
  ["My profile", "/employers/profile"],
  ["Sign in", "/employers/login"],
];

export default function EmployerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 hover:text-brass-400"
      >
        Employers
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-navy-800 hover:bg-navy-50"
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
