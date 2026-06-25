"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MultiSelect, { toggleValue as toggle, type Option } from "@/components/MultiSelect";
import { ROLE_CATEGORIES } from "@/lib/taxonomy";

interface Props {
  /** States that have live inventory, as {code,name}. */
  states: { code: string; name: string }[];
  /** Every city with inventory, paired with its state code. */
  cities: { city: string; state: string }[];
  companies: string[];
  selectedStates?: string[];
  selectedCategories?: string[];
  selectedCities?: string[];
  selectedCompanies?: string[];
  /** Preserve the current sort across a new search. */
  sort?: string;
}

/**
 * Multi-select job search. Roles, states, cities and companies are each a
 * checkbox dropdown; the city list is scoped to the chosen state(s). Submits as
 * a plain GET form (repeated params → array filters), so results stay
 * shareable/SEO-friendly and work even though the controls are client-side.
 */
export default function SearchForm({
  states,
  cities,
  companies,
  selectedStates = [],
  selectedCategories = [],
  selectedCities = [],
  selectedCompanies = [],
  sort,
}: Props) {
  const [stateSel, setStateSel] = useState<string[]>(selectedStates);
  const [catSel, setCatSel] = useState<string[]>(selectedCategories);
  const [citySel, setCitySel] = useState<string[]>(selectedCities);
  const [coSel, setCoSel] = useState<string[]>(selectedCompanies);

  // Cities that fit the chosen state(s). Selecting a city then narrowing the
  // states drops it from this set (and from submission), avoiding contradictory
  // filters like state=CA AND city=Miami — derived, not stored, so re-broadening
  // the states brings the city back.
  const effectiveCitySel = useMemo(() => {
    if (stateSel.length === 0) return citySel;
    const allowed = new Set(cities.filter((c) => stateSel.includes(c.state)).map((c) => c.city));
    return citySel.filter((c) => allowed.has(c));
  }, [citySel, stateSel, cities]);

  const roleOptions = ROLE_CATEGORIES.map((r) => ({ value: r.slug, label: r.label }));
  const stateOptions = states.map((s) => ({ value: s.code, label: s.name }));
  const companyOptions = useMemo(
    () => [...companies].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [companies]
  );

  // Cities limited to the selected state(s) — or all when none chosen. Labels
  // gain a ", ST" suffix when more than one state is in scope, for disambiguation.
  const cityOptions = useMemo(() => {
    const multiState = stateSel.length !== 1;
    const inScope = cities.filter((c) => stateSel.length === 0 || stateSel.includes(c.state));
    const seen = new Set<string>();
    const opts: Option[] = [];
    for (const c of inScope) {
      if (seen.has(c.city)) continue;
      seen.add(c.city);
      opts.push({ value: c.city, label: multiState ? `${c.city}, ${c.state}` : c.city });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [cities, stateSel]);

  const hidden = (name: string, values: string[]) =>
    values.map((v) => <input key={`${name}:${v}`} type="hidden" name={name} value={v} />);

  const totalSelected = catSel.length + stateSel.length + effectiveCitySel.length + coSel.length;

  return (
    <form action="/jobs" method="get">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelect label="All roles" options={roleOptions} selected={catSel} onToggle={toggle(setCatSel)} />
        <MultiSelect label="All states" options={stateOptions} selected={stateSel} onToggle={toggle(setStateSel)} searchable />
        <MultiSelect label="All cities" options={cityOptions} selected={effectiveCitySel} onToggle={toggle(setCitySel)} searchable />
        <MultiSelect label="All companies" options={companyOptions} selected={coSel} onToggle={toggle(setCoSel)} searchable />
      </div>

      {hidden("category", catSel)}
      {hidden("state", stateSel)}
      {hidden("city", effectiveCitySel)}
      {hidden("company", coSel)}
      {sort && sort !== "newest" && <input type="hidden" name="sort" value={sort} />}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600"
        >
          Search
        </button>
        {totalSelected > 0 && (
          <Link href="/jobs" className="text-sm text-slate-500 hover:underline">
            Clear all
          </Link>
        )}
      </div>
    </form>
  );
}
