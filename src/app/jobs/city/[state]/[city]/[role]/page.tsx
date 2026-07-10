import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobRow from "@/components/JobRow";
import AlertSignupForm from "@/components/AlertSignupForm";
import SalaryFigures from "@/components/SalaryFigures";
import { countByCityAndCategory, fairlyRotate, getFeaturedJobs, listJobs, type Job } from "@/lib/jobs";
import { fmtAnnual, MIN_SAMPLE_FOR_STATS, salaryStats, statsFromRows } from "@/lib/salary";
import { citySlug, ROLE_CATEGORIES, roleFromSlug, stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.SITE_URL ?? "https://www.boatyardjobs.com").replace(/\/$/, "");

/** Serialize JSON-LD, escaping `<>&` so a scraped city name can't break out of
 *  the script tag (matches the job detail page's hardening). */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&]/g,
    (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[c]!
  );
}

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
  // A pay figure in the snippet lifts click-through; use the state-wide median
  // (city samples are usually too thin to quote reliably in metadata).
  const stats = await salaryStats(match.role.slug, match.code);
  const pay =
    stats && stats.n >= MIN_SAMPLE_FOR_STATS
      ? ` Typical pay around ${fmtAnnual(stats.median)}/yr.`
      : "";
  return {
    title: `${match.role.label} Jobs in ${match.city}, ${match.stateName}`,
    description: `${match.n} open ${match.role.label.toLowerCase()} job${
      match.n === 1 ? "" : "s"
    } at boatyards, marinas and dealerships in ${match.city}, ${match.stateName}.${pay} ${
      match.role.description
    } Updated daily.`,
  };
}

/**
 * BreadcrumbList structured data for the Jobs → State → City → Role trail. Gives
 * Google an explicit crawl path and a richer breadcrumb in the SERP.
 */
function breadcrumbJsonLd(
  state: string,
  city: string,
  stateName: string,
  cityName: string,
  roleLabel: string
) {
  const crumbs = [
    { name: "Jobs", url: `${SITE_URL}/jobs` },
    { name: stateName, url: `${SITE_URL}/jobs/state/${state}` },
    { name: cityName, url: `${SITE_URL}/jobs/city/${state}/${city}` },
    { name: roleLabel, url: null },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  };
}

export default async function CityRoleJobsPage({ params }: Props) {
  const { state, city, role } = await params;
  const match = await resolve(state, city, role);
  if (!match) notFound();

  const [featuredRaw, { jobs }, rows, stateStats] = await Promise.all([
    getFeaturedJobs({ state: match.code, city: match.city, category: match.role.slug }),
    listJobs({
      state: match.code,
      city: match.city,
      category: match.role.slug,
      excludeFeatured: true,
      limit: 100,
    }),
    countByCityAndCategory(),
    salaryStats(match.role.slug, match.code),
  ]);
  const featured = fairlyRotate(featuredRaw);
  const shown = featured.length + jobs.length;

  // Live pay band for this role. Prefer city-specific figures computed from the
  // listings on this page; fall back to the state-wide range when the city has
  // too few salaried listings to be reliable. Gives every page real, unique pay
  // content and a link into the salary hub.
  const salarySample: Job[] = [...featured, ...jobs];
  const cityStats = statsFromRows(salarySample);
  const showCityStats = !!cityStats && cityStats.n >= MIN_SAMPLE_FOR_STATS;
  const salaryToShow = showCityStats
    ? cityStats
    : stateStats && stateStats.n >= MIN_SAMPLE_FOR_STATS
      ? stateStats
      : null;
  const salaryScope = showCityStats ? `in ${match.city}` : `in ${match.stateName}`;

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            breadcrumbJsonLd(state, city, match.stateName, match.city, match.role.label)
          ),
        }}
      />

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

      {salaryToShow && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
          <h2 className="text-sm font-semibold text-navy-800">
            What {match.role.label.toLowerCase()}s earn {salaryScope}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Median pay is around <strong>{fmtAnnual(salaryToShow.median)}</strong> a year
            {showCityStats ? ` in ${match.city}` : `, based on ${match.stateName}-wide listings`}.{" "}
            <Link
              href={`/salary/${match.role.slug}/${state}`}
              className="text-navy-600 hover:underline"
            >
              See the full {match.role.label.toLowerCase()} pay breakdown →
            </Link>
          </p>
          <div className="mt-4">
            <SalaryFigures stats={salaryToShow} label={match.role.label} scope={salaryScope} />
          </div>
        </section>
      )}

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
