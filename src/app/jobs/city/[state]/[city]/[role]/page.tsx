import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByCityAndCategory, fairlyRotate, getFeaturedJobs, listJobs } from "@/lib/jobs";
import { citySlug, ROLE_CATEGORIES, roleFromSlug, stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ state: string; city: string; role: string }>;
}

/**
 * Resolve a (state slug, city slug, role slug) triple to the canonical city
 * display name and the live count for that role, or null if nothing matches.
 * Shared by the page and its metadata so both agree on the city spelling.
 */
async function resolve(
  stateSlugParam: string,
  cityParam: string,
  roleParam: string
): Promise<{
  code: string;
  stateName: string;
  city: string;
  role: { slug: string; label: string; description: string };
  n: number;
} | null> {
  const stateMatch = stateFromSlug(stateSlugParam);
  const roleMatch = roleFromSlug(roleParam);
  if (!stateMatch || !roleMatch) return null;
  const rows = await countByCityAndCategory();
  const match = rows.find(
    (c) =>
      c.state === stateMatch.code &&
      c.category === roleMatch.slug &&
      citySlug(c.city) === cityParam.toLowerCase()
  );
  if (!match) return null;
  return {
    code: stateMatch.code,
    stateName: stateMatch.name,
    city: match.city,
    role: roleMatch,
    n: match.n,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city, role } = await params;
  const match = await resolve(state, city, role);
  if (!match) return { title: "Not found" };
  return {
    title: `${match.role.label} Jobs in ${match.city}, ${match.stateName}`,
    description: `${match.n} open ${match.role.label.toLowerCase()} job${
      match.n === 1 ? "" : "s"
    } at boatyards, marinas and dealerships in ${match.city}, ${match.stateName}. ${
      match.role.description
    } Updated daily.`,
  };
}

export default async function CityRoleJobsPage({ params }: Props) {
  const { state, city, role } = await params;
  const match = await resolve(state, city, role);
  if (!match) notFound();

  const [featuredRaw, { jobs }, rows] = await Promise.all([
    getFeaturedJobs({ state: match.code, city: match.city, category: match.role.slug }),
    listJobs({
      state: match.code,
      city: match.city,
      category: match.role.slug,
      excludeFeatured: true,
      limit: 100,
    }),
    countByCityAndCategory(),
  ]);
  const featured = fairlyRotate(featuredRaw);
  const shown = featured.length + jobs.length;

  // Other trades hiring in THIS city → chips to the sibling role×city pages.
  const rolesHere = ROLE_CATEGORIES.filter(
    (r) =>
      r.slug !== match.role.slug &&
      rows.some((c) => c.state === match.code && citySlug(c.city) === city.toLowerCase() && c.category === r.slug && c.n > 0)
  );

  // Same role in OTHER cities of this state, busiest first → role×city links that
  // help candidates and Google traverse the long-tail set.
  const otherCities = rows
    .filter(
      (c) => c.state === match.code && c.category === match.role.slug && citySlug(c.city) !== city.toLowerCase()
    )
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/jobs/state/${state}`} className="hover:underline">{match.stateName}</Link>
        {" / "}
        <Link href={`/jobs/city/${state}/${city}`} className="hover:underline">{match.city}</Link>
        {" / "}
        <span className="text-slate-700">{match.role.label}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-navy-800">
        {match.role.label} Jobs in {match.city}, {match.stateName}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">{match.role.description}</p>
      <p className="mt-4 text-sm text-slate-500">
        {shown} open {match.role.label.toLowerCase()} position{shown === 1 ? "" : "s"} in{" "}
        {match.city}.{" "}
        <Link href={`/jobs/state/${state}/${match.role.slug}`} className="text-navy-600 hover:underline">
          See all {match.role.label.toLowerCase()} jobs in {match.stateName} →
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
          No open {match.role.label.toLowerCase()} jobs in {match.city} right now — set an alert
          below and be first to know.
        </p>
      )}

      {rolesHere.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            Other marine trades hiring in {match.city}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rolesHere.map((r) => (
              <Link
                key={r.slug}
                href={`/jobs/city/${state}/${city}/${r.slug}`}
                className="rounded-full bg-navy-50 px-3 py-1 text-sm font-medium text-navy-700 hover:bg-navy-100"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {otherCities.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-navy-800">
            {match.role.label} jobs in other {match.stateName} cities
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.city}
                href={`/jobs/city/${state}/${citySlug(c.city)}/${match.role.slug}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                {c.city} <span className="text-slate-400">({c.n})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">
          New {match.role.label.toLowerCase()} jobs in {match.city} by email
        </h2>
        <p className="mt-1 text-sm text-navy-100">
          We alert by state and trade — get {match.city}-area {match.role.label.toLowerCase()}{" "}
          listings as they post.
        </p>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm state={match.code} category={match.role.slug} compact />
        </div>
      </div>
    </div>
  );
}
