import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobCard from "@/components/JobCard";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByStateAndCategory, listJobs } from "@/lib/jobs";
import { ROLE_CATEGORIES, roleFromSlug, stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ state: string; role: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, role } = await params;
  const stateMatch = stateFromSlug(state);
  const roleMatch = roleFromSlug(role);
  if (!stateMatch || !roleMatch) return { title: "Not found" };
  return {
    title: `${roleMatch.label} Jobs in ${stateMatch.name}`,
    description: `${roleMatch.label} jobs at boatyards, marinas and dealerships in ${stateMatch.name}. ${roleMatch.description} Updated daily.`,
  };
}

export default async function StateRoleJobsPage({ params }: Props) {
  const { state, role } = await params;
  const stateMatch = stateFromSlug(state);
  const roleMatch = roleFromSlug(role);
  if (!stateMatch || !roleMatch) notFound();

  const [{ jobs, total }, counts] = await Promise.all([
    listJobs({ state: stateMatch.code, category: roleMatch.slug, limit: 100 }),
    countByStateAndCategory(),
  ]);

  // Other trades that actually have openings in this state — internal links that
  // help both candidates and Google discover the rest of the board.
  const siblingRoles = ROLE_CATEGORIES.filter(
    (r) =>
      r.slug !== roleMatch.slug &&
      counts.some((c) => c.state === stateMatch.code && c.category === r.slug && c.n > 0)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/jobs/state/${state}`} className="hover:underline">{stateMatch.name}</Link>
        {" / "}
        <span className="text-slate-700">{roleMatch.label}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-navy-800">
        {roleMatch.label} Jobs in {stateMatch.name}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">{roleMatch.description}</p>
      <p className="mt-4 text-sm text-slate-500">
        {total} open position{total === 1 ? "" : "s"} in {stateMatch.name}.{" "}
        <Link href={`/jobs/role/${roleMatch.slug}`} className="text-navy-600 hover:underline">
          See {roleMatch.label.toLowerCase()} jobs nationwide →
        </Link>
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
      {jobs.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No open {roleMatch.label.toLowerCase()} jobs in {stateMatch.name} right now — set an
          alert below and be first to know.
        </p>
      )}

      {siblingRoles.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            Other marine trades hiring in {stateMatch.name}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {siblingRoles.map((r) => (
              <Link
                key={r.slug}
                href={`/jobs/state/${state}/${r.slug}`}
                className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium text-navy-700 hover:bg-navy-100"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">
          New {roleMatch.label.toLowerCase()} jobs in {stateMatch.name} by email
        </h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm state={stateMatch.code} category={roleMatch.slug} compact />
        </div>
      </div>
    </div>
  );
}
