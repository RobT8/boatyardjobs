import type { Metadata } from "next";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByCity, countByState } from "@/lib/jobs";
import { US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Job Alerts",
  description:
    "Get new marine trades jobs for your state and specialty by email — free for candidates.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    subscribed?: string;
    confirmed?: string;
    unsubscribed?: string;
    already?: string;
    error?: string;
  }>;
}

export default async function AlertsPage({ searchParams }: Props) {
  const { subscribed, confirmed, unsubscribed, already, error } = await searchParams;
  const [stateCounts, cityCounts] = await Promise.all([countByState(), countByCity()]);
  const stateOptions = stateCounts
    .map((s) => ({ code: s.state, name: US_STATES[s.state] ?? s.state }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityOptions = cityCounts.map((c) => ({ city: c.city, state: c.state }));
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">Job Alerts</h1>
      <p className="mt-3 text-slate-600">
        Tell us your trades and the states or cities you care about, and we&apos;ll email you when
        matching jobs are posted. Free for candidates, always — no account needed.
      </p>

      {subscribed && (
        <p className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Almost there — check your inbox and click the confirmation link to start your alerts.
        </p>
      )}
      {confirmed && (
        <p className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          You&apos;re confirmed! We&apos;ll email you when matching jobs appear.
        </p>
      )}
      {already && (
        <p className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          You&apos;re already subscribed for that search — you&apos;re all set.
        </p>
      )}
      {unsubscribed && (
        <p className="mt-6 rounded-md bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          You&apos;ve been unsubscribed. Sorry to see you go — sign up again any time.
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error === "bad-token"
            ? "That confirmation link is invalid or has expired. Please sign up again."
            : "Please enter a valid email address."}
        </p>
      )}

      <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <AlertSignupForm states={stateOptions} cities={cityOptions} />
      </div>
    </div>
  );
}
