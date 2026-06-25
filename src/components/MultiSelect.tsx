"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}

/** A checkbox dropdown. Pure UI — the parent owns the selection and renders the
 *  hidden inputs that actually submit, so values survive the panel being closed. */
export default function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  searchable = false,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? options.filter((o) => o.label.toLowerCase().includes(f)) : options;
  }, [options, filter]);

  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:border-navy-400"
      >
        <span className={count ? "font-medium text-navy-800" : "text-slate-500"}>
          {count ? `${label} (${count})` : label}
        </span>
        <span aria-hidden className="ml-2 text-slate-400">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full min-w-[14rem] overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {searchable && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-navy-500 focus:outline-none"
            />
          )}
          {shown.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">No matches.</p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((o) => (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-navy-50">
                    <input
                      type="checkbox"
                      checked={selected.includes(o.value)}
                      onChange={() => onToggle(o.value)}
                      className="h-4 w-4 rounded border-slate-300 text-navy-700"
                    />
                    <span className="text-slate-700">{o.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Curried toggle helper for a `string[]` selection state setter. */
export const toggleValue =
  (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
