import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import { getEmployerById, listEmployerPublishedJobs } from "@/lib/employers";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

/** Resolve the numeric [id] to an employer that has published listings, or null.
 *  Employers with no live jobs (or a non-numeric id) are treated as not found so
 *  we never index an empty page. */
async function resolve(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  const employer = await getEmployerById(id);
  if (!employer) return null;
  const jobs = await listEmployerPublishedJobs(id);
  if (jobs.length === 0) return null;
  return { employer, jobs };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = await resolve(id);
  if (!match) return { title: "Not found", robots: { index: false, follow: false } };
  const { employer, jobs } = match;
  return {
    title: `Jobs at ${employer.company} — Marine & Boatyard Careers`,
    description: `${jobs.length} open marine trades job${
      jobs.length === 1 ? "" : "s"
    } at ${employer.company} on BoatyardJobs. Apply directly to current boatyard, marina and dealership openings.`,
  };
}

export default async function EmployerPublicPage({ params }: Props) {
  const { id } = await params;
  const match = await resolve(id);
  if (!match) notFound();
  const { employer, jobs } = match;

  // The trades this employer is hiring for → context + on-page substance.
  const roleLabels = [
    ...new Set(
      jobs.map((j) => ROLE_CATEGORIES.find((r) => r.slug === j.category)?.label ?? null).filter(Boolean)
    ),
  ] as string[];
  const states = [...new Set(jobs.map((j) => US_STATES[j.state] ?? j.state))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <span className="text-slate-700">{employer.company}</span>
      </nav>

      <div className="mt-3 flex items-start gap-4">
        {employer.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={employer.logo_url}
            alt={`${employer.company} logo`}
            className="h-14 w-14 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-navy-800">Jobs at {employer.company}</h1>
          <p className="mt-1 text-slate-600">
            {jobs.length} open marine trades role{jobs.length === 1 ? "" : "s"}
            {states.length > 0 && ` in ${states.slice(0, 3).join(", ")}`}.
            {employer.website && (
              <>
                {" "}
                <a
                  href={employer.website}
                  target="_blank"
                  rel="noopener nofollow"
                  className="text-navy-600 hover:underline"
                >
                  Visit company site →
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      {roleLabels.length > 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Hiring for: {roleLabels.join(" · ")}.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="font-semibold text-navy-800">Browse more marine trades jobs</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          BoatyardJobs is the dedicated job board for the US recreational marine trades.
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-block rounded-md bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          See all jobs →
        </Link>
      </div>
    </div>
  );
}
