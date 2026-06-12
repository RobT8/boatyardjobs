import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

interface Props {
  q?: string;
  state?: string;
  category?: string;
}

/** Server-rendered GET form — works without client JS. */
export default function SearchForm({ q, state, category }: Props) {
  return (
    <form action="/jobs" method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search title, company, city…"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
      />
      <select
        name="state"
        defaultValue={state ?? ""}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All states</option>
        {Object.entries(US_STATES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <select
        name="category"
        defaultValue={category ?? ""}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All roles</option>
        {ROLE_CATEGORIES.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.label}
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
