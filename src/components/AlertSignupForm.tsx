import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

interface Props {
  state?: string;
  category?: string;
  compact?: boolean;
}

/** Posts to /api/alerts which redirects back with ?subscribed=1. */
export default function AlertSignupForm({ state, category, compact }: Props) {
  return (
    <form
      action="/api/alerts"
      method="post"
      className={compact ? "flex flex-wrap gap-2" : "grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"}
    >
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="min-w-48 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
      />
      {compact ? (
        <>
          <input type="hidden" name="state" value={state ?? ""} />
          <input type="hidden" name="category" value={category ?? ""} />
        </>
      ) : (
        <>
          <select name="state" defaultValue={state ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All states</option>
            {Object.entries(US_STATES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <select name="category" defaultValue={category ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All roles</option>
            {ROLE_CATEGORIES.map((r) => (
              <option key={r.slug} value={r.slug}>{r.label}</option>
            ))}
          </select>
        </>
      )}
      <button
        type="submit"
        className="rounded-md bg-brass-400 px-5 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500"
      >
        Get Job Alerts
      </button>
    </form>
  );
}
