import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByStateAndCategory, fairlyRotate, getFeaturedJobs, listJobs } from "@/lib/jobs";
import { roleFromSlug, stateSlug, US_STATES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ role: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) return { title: "Not found" };
  return {
    title: `${match.label} Jobs`,
    description: `${match.description} Open positions across the US, updated daily.`,
  };
}

export default async function RoleJobsPage({ params }: Props) {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) notFound();

  const [featuredRaw, { jobs, total }, counts] = await Promise.all([
    getFeaturedJobs({ category: match.slug }),
    listJobs({ category: match.slug, excludeFeatured: true, limit: 100 }),
    countByStateAndCategory(),
  ]);
  const featured = fairlyRotate(featuredRaw);

  const statesHere = counts
    .filter((c) => c.category === match.slug && c.n > 0)
    .map((c) => ({ code: c.state, name: US_STATES[c.state] ?? c.state, n: c.n }))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">{match.label} Jobs</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{match.description}</p>
      <p className="mt-4 text-sm text-slate-500">
        {total + featured.length} open position{total + featured.length === 1 ? "" : "s"}
      </p>
      {featured.length > 0 && (
        <div className="mt-4 space-y-3">
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
          No open {match.label.toLowerCase()} jobs right now — set an alert below.
        </p>
      )}

      {statesHere.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            {match.label} jobs by state
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {statesHere.map(({ code, name, n }) => (
              <Link
                key={code}
                href={`/jobs/state/${stateSlug(code)}/${match.slug}`}
                className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium text-navy-700 hover:bg-navy-100"
              >
                {name} <span className="text-slate-400">({n})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">New {match.label.toLowerCase()} jobs by email</h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm category={match.slug} compact />
        </div>
      </div>
    </div>
  );
}
