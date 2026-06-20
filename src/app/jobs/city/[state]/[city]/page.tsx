import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByCity, fairlyRotate, getFeaturedJobs, listJobs } from "@/lib/jobs";
import { citySlug, ROLE_CATEGORIES, stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ state: string; city: string }>;
}

/** Resolve a (state slug, city slug) pair to the canonical city display name,
 *  or null if no live inventory matches. Shared by the page and its metadata. */
async function resolveCity(
  stateSlugParam: string,
  cityParam: string
): Promise<{ code: string; stateName: string; city: string; n: number } | null> {
  const stateMatch = stateFromSlug(stateSlugParam);
  if (!stateMatch) return null;
  const cities = await countByCity();
  const match = cities.find(
    (c) => c.state === stateMatch.code && citySlug(c.city) === cityParam.toLowerCase()
  );
  if (!match) return null;
  return { code: stateMatch.code, stateName: stateMatch.name, city: match.city, n: match.n };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city } = await params;
  const match = await resolveCity(state, city);
  if (!match) return { title: "Not found" };
  return {
    title: `Marine Trades Jobs in ${match.city}, ${match.stateName}`,
    description: `${match.n} open marine technician, electrician, rigger and boatyard job${
      match.n === 1 ? "" : "s"
    } in ${match.city}, ${match.stateName}. Boatyards, marinas and dealerships — updated daily.`,
  };
}

export default async function CityJobsPage({ params }: Props) {
  const { state, city } = await params;
  const match = await resolveCity(state, city);
  if (!match) notFound();

  const [featuredRaw, { jobs }, cities] = await Promise.all([
    getFeaturedJobs({ state: match.code, city: match.city }),
    listJobs({ state: match.code, city: match.city, excludeFeatured: true, limit: 200 }),
    countByCity(),
  ]);
  const featured = fairlyRotate(featuredRaw);
  const shown = featured.length + jobs.length;

  // Trades represented in this city → chips linking to the state×role pages.
  const rolesHere = ROLE_CATEGORIES.map((r) => ({
    role: r,
    n: [...featured, ...jobs].filter((j) => j.category === r.slug).length,
  })).filter((x) => x.n > 0);

  // Other cities hiring in the same state, busiest first — internal links that
  // help candidates and Google discover the rest of the board.
  const otherCities = cities
    .filter((c) => c.state === match.code && citySlug(c.city) !== city.toLowerCase())
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/jobs/state/${state}`} className="hover:underline">{match.stateName}</Link>
        {" / "}
        <span className="text-slate-700">{match.city}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-navy-800">
        Marine Trades Jobs in {match.city}, {match.stateName}
      </h1>
      <p className="mt-2 text-slate-600">
        {shown} open position{shown === 1 ? "" : "s"} at boatyards, marinas and dealerships in{" "}
        {match.city}.{" "}
        <Link href={`/jobs/state/${state}`} className="text-navy-600 hover:underline">
          See all {match.stateName} jobs →
        </Link>
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
      {shown === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No open jobs in {match.city} right now — set an alert below and be first to know.
        </p>
      )}

      {rolesHere.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            {match.city} jobs by trade
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

      {otherCities.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            Other cities hiring in {match.stateName}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCities.map((c) => (
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
        <h2 className="font-semibold">New {match.stateName} jobs by email</h2>
        <p className="mt-1 text-sm text-navy-100">
          We alert by state and trade — get {match.city}-area listings as they post.
        </p>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm state={match.code} compact />
        </div>
      </div>
    </div>
  );
}
