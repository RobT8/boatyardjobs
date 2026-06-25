import AlertFullForm from "@/components/AlertFullForm";

interface Props {
  state?: string;
  category?: string;
  compact?: boolean;
  /** Full variant only: states/cities with live inventory for the pickers. */
  states?: { code: string; name: string }[];
  cities?: { city: string; state: string }[];
}

/**
 * Posts to /api/alerts which redirects back with ?subscribed=1.
 *
 * The compact variant (embedded on a job page) carries a single pre-filled
 * state/category as hidden fields. The full variant lets the candidate tick any
 * number of roles, states and cities — each ticked role × location becomes its
 * own alert subscription.
 */
export default function AlertSignupForm({ state, category, compact, states, cities }: Props) {
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

  return <AlertFullForm states={states} cities={cities} category={category} />;
}
