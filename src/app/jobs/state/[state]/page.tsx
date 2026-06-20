import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import AlertSignupForm from "@/components/AlertSignupForm";
import {
  countByCity,
  countByStateAndCategory,
  fairlyRotate,
  getFeaturedJobs,
  listJobs,
} from "@/lib/jobs";
import { citySlug, ROLE_CATEGORIES, stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const match = stateFromSlug(state);
  if (!match) return { title: "Not found" };
  return {
    title: `Marine Trades Jobs in ${match.name}`,
    description: `Open marine technician, electrician, rigger and boatyard jobs in ${match.name}. Updated daily.`,
  };
}

export default async function StateJobsPage({ params }: Props) {
  const { state } = await params;
  const match = stateFromSlug(state);
  if (!match) notFound();

  const [featuredRaw, { jobs, total }, counts, allCities] = await Promise.all([
    getFeaturedJobs({ state: match.code }),
    listJobs({ state: match.code, excludeFeatured: true, limit: 100 }),
    countByStateAndCategory(),
    countByCity(),
  ]);
  const featured = fairlyRotate(featuredRaw);

  const rolesHere = ROLE_CATEGORIES.map((r) => ({
    role: r,
    n: counts.find((c) => c.state === match.code && c.category === r.slug)?.n ?? 0,
  })).filter((x) => x.n > 0);

  // Cities in this state with live inventory, busiest first.
  const citiesHere = allCities.filter((c) => c.state === match.code).slice(0, 15);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">
        Marine Trades Jobs in {match.name}
      </h1>
      <p className="mt-2 text-slate-600">
        {total + featured.length} open position{total + featured.length === 1 ? "" : "s"} at
        boatyards, marinas and dealerships in {match.name}.
      </p>
      {featured.length > 0 && (
        <div className="mt-6 space-y-3">
          {featured.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
      <div className="mt-3 space-y-3">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>
      {jobs.length === 0 && featured.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No open jobs in {match.name} right now — set an alert below and be first to know.
        </p>
      )}

      {rolesHere.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            {match.name} jobs by trade
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rolesHere.map(({ role, n }) => (
              <Link
                key={role.slug}
                href={`/jobs/state/${state}/${role.slug}`}
                className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium text-navy-700 hover:bg-navy-100"
              >
                {role.label} <span className="text-slate-400">({n})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {citiesHere.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            {match.name} jobs by city
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {citiesHere.map((c) => (
              <Link
                key={c.city}
                href={`/jobs/city/${state}/${citySlug(c.city)}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                {c.city} <span className="text-slate-400">({c.n})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">New {match.name} jobs by email</h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm state={match.code} compact />
        </div>
      </div>
    </div>
  );
}
