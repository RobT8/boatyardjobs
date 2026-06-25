"use client";

import { useMemo, useState } from "react";
import MultiSelect, { toggleValue as toggle, type Option } from "@/components/MultiSelect";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

interface Props {
  /** States with live inventory, as {code,name}. Falls back to all US states. */
  states?: { code: string; name: string }[];
  /** Cities with live inventory, paired with their state code. */
  cities?: { city: string; state: string }[];
  /** Pre-ticked role (e.g. when embedded under a role page). */
  category?: string;
}

/**
 * Full job-alert signup. The candidate can tick any number of roles, states and
 * cities; each ticked location becomes its own subscription (state and city are
 * independent — "FL OR Miami", not "FL AND Miami"), crossed with each ticked
 * role. Submits as a plain POST so it works without the controls' JS having to
 * serialize anything — the hidden inputs carry the selection.
 *
 * City option values are encoded `ST|City` so the same city name in two states
 * stays distinct (see /api/alerts).
 */
export default function AlertFullForm({ states, cities = [], category }: Props) {
  const stateList =
    states && states.length
      ? states
      : Object.entries(US_STATES).map(([code, name]) => ({ code, name }));

  const [catSel, setCatSel] = useState<string[]>(category ? [category] : []);
  const [stateSel, setStateSel] = useState<string[]>([]);
  const [citySel, setCitySel] = useState<string[]>([]);

  const roleOptions = ROLE_CATEGORIES.map((r) => ({ value: r.slug, label: r.label }));
  const stateOptions = useMemo(
    () =>
      [...stateList]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.code, label: s.name })),
    [stateList]
  );
  // Cities are always disambiguated with ", ST" since states aren't a filter here.
  const cityOptions = useMemo<Option[]>(
    () =>
      cities
        .map((c) => ({ value: `${c.state}|${c.city}`, label: `${c.city}, ${c.state}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [cities]
  );

  const hidden = (name: string, values: string[]) =>
    values.map((v) => <input key={`${name}:${v}`} type="hidden" name={name} value={v} />);

  return (
    <form action="/api/alerts" method="post" className="grid gap-4">
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label="Your email"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MultiSelect label="All roles" options={roleOptions} selected={catSel} onToggle={toggle(setCatSel)} searchable />
        <MultiSelect label="All states" options={stateOptions} selected={stateSel} onToggle={toggle(setStateSel)} searchable />
        {cityOptions.length > 0 && (
          <MultiSelect label="Any city" options={cityOptions} selected={citySel} onToggle={toggle(setCitySel)} searchable />
        )}
      </div>
      <p className="-mt-1 text-xs text-slate-500">
        Pick any roles, states and cities — leave them all blank for every marine trades job
        nationwide. States and cities are independent, so you can watch a whole state and a city in
        another at the same time.
      </p>

      {hidden("category", catSel)}
      {hidden("state", stateSel)}
      {hidden("city", citySel)}

      <button
        type="submit"
        className="justify-self-start rounded-md bg-brass-400 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-brass-500"
      >
        Get Job Alerts
      </button>
    </form>
  );
}
