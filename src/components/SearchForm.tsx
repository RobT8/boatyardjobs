import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

interface Props {
  state?: string;
  category?: string;
  company?: string;
  companies: string[];
}

const selectCls =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-none";

/** Server-rendered GET form — works without client JS. Three dropdowns:
 * All roles, All States, All Companies. */
export default function SearchForm({ state, category, company, companies }: Props) {
  return (
    <form action="/jobs" method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <select name="category" defaultValue={category ?? ""} aria-label="Filter by role" className={selectCls}>
        <option value="">All roles</option>
        {ROLE_CATEGORIES.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.label}
          </option>
        ))}
      </select>
      <select name="state" defaultValue={state ?? ""} aria-label="Filter by state" className={selectCls}>
        <option value="">All States</option>
        {Object.entries(US_STATES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <select name="company" defaultValue={company ?? ""} aria-label="Filter by company" className={selectCls}>
        <option value="">All Companies</option>
        {companies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600"
      >
        Search
      </button>
    </form>
  );
}
