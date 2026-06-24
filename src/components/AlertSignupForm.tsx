import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

interface Props {
  state?: string;
  category?: string;
  compact?: boolean;
}

/**
 * Posts to /api/alerts which redirects back with ?subscribed=1.
 *
 * The compact variant (embedded on a job page) carries a single pre-filled
 * state/category as hidden fields. The full variant lets the candidate tick any
 * number of roles — each ticked role becomes its own alert subscription.
 */
export default function AlertSignupForm({ state, category, compact }: Props) {
  if (compact) {
    return (
      <form action="/api/alerts" method="post" className="flex flex-wrap gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Your email"
          className="min-w-48 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none"
        />
        <input type="hidden" name="state" value={state ?? ""} />
        <input type="hidden" name="category" value={category ?? ""} />
        <button
          type="submit"
          className="rounded-md bg-brass-400 px-5 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500"
        >
          Get Job Alerts
        </button>
      </form>
    );
  }

  return (
    <form action="/api/alerts" method="post" className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Your email"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none"
        />
        <select
          name="state"
          defaultValue={state ?? ""}
          aria-label="State"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-none"
        >
          <option value="">All states</option>
          {Object.entries(US_STATES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-navy-800">
          Which roles do you want alerts for?
        </legend>
        <p className="mt-1 text-xs text-slate-500">
          Tick any that apply — leave them all unticked to get alerts for every role.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLE_CATEGORIES.map((r) => (
            <label
              key={r.slug}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
            >
              <input
                type="checkbox"
                name="category"
                value={r.slug}
                defaultChecked={category === r.slug}
                className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-600"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="justify-self-start rounded-md bg-brass-400 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-brass-500"
      >
        Get Job Alerts
      </button>
    </form>
  );
}
