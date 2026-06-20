import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AlertSignupForm from "@/components/AlertSignupForm";
import SalaryFigures from "@/components/SalaryFigures";
import { countByStateAndCategory } from "@/lib/jobs";
import { fmtAnnual, MIN_SAMPLE_FOR_STATS, salaryStats } from "@/lib/salary";
import { roleFromSlug, stateFromSlug, stateSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ role: string; state: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role, state } = await params;
  const roleMatch = roleFromSlug(role);
  const stateMatch = stateFromSlug(state);
  if (!roleMatch || !stateMatch) return { title: "Not found" };
  const stats = await salaryStats(roleMatch.slug, stateMatch.code);
  const figure =
    stats && stats.n >= MIN_SAMPLE_FOR_STATS
      ? ` Median pay is around ${fmtAnnual(stats.median)} a year.`
      : "";
  return {
    title: `${roleMatch.label} Salary in ${stateMatch.name}`,
    description: `How much do ${roleMatch.label.toLowerCase()}s earn in ${stateMatch.name}?${figure} Live pay from open boatyard, marina and dealership listings.`,
  };
}

function occupationJsonLd(
  label: string,
  description: string,
  stateName: string,
  code: string,
  stats: NonNullable<Awaited<ReturnType<typeof salaryStats>>>
) {
  return {
    "@context": "https://schema.org/",
    "@type": "Occupation",
    name: label,
    description,
    occupationLocation: {
      "@type": "State",
      name: stateName,
      address: { "@type": "PostalAddress", addressRegion: code, addressCountry: "US" },
    },
    estimatedSalary: [
      {
        "@type": "MonetaryAmountDistribution",
        name: "base",
        currency: "USD",
        duration: "P1Y",
        percentile25: stats.p25,
        median: stats.median,
        percentile75: stats.p75,
      },
    ],
  };
}

export default async function RoleStateSalaryPage({ params }: Props) {
  const { role, state } = await params;
  const roleMatch = roleFromSlug(role);
  const stateMatch = stateFromSlug(state);
  if (!roleMatch || !stateMatch) notFound();

  const [stats, counts] = await Promise.all([
    salaryStats(roleMatch.slug, stateMatch.code),
    countByStateAndCategory(),
  ]);
  const openings =
    counts.find((c) => c.state === stateMatch.code && c.category === roleMatch.slug)?.n ?? 0;
  const hasFigures = !!stats && stats.n >= 1;

  // Nothing to show — no pay data and no live roles here. Keep it out of the index.
  if (!hasFigures && openings === 0) notFound();

  const confident = !!stats && stats.n >= MIN_SAMPLE_FOR_STATS;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {confident && stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              occupationJsonLd(roleMatch.label, roleMatch.description, stateMatch.name, stateMatch.code, stats)
            ),
          }}
        />
      )}

      <nav className="text-sm text-slate-500">
        <Link href="/salary" className="hover:underline">Salaries</Link>
        {" / "}
        <Link href={`/salary/${roleMatch.slug}`} className="hover:underline">{roleMatch.label}</Link>
        {" / "}
        <span className="text-slate-700">{stateMatch.name}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-navy-800">
        {roleMatch.label} Salary in {stateMatch.name}
      </h1>

      {hasFigures && stats ? (
        <p className="mt-3 text-lg text-slate-700">
          {roleMatch.label}s in {stateMatch.name} earn a median of about{" "}
          <strong>{fmtAnnual(stats.median)}</strong> per year, with most roles paying between{" "}
          <strong>{fmtAnnual(stats.p25)}</strong> and <strong>{fmtAnnual(stats.p75)}</strong>.{" "}
          <Link href={`/salary/${roleMatch.slug}`} className="text-navy-600 hover:underline">
            Compare to the US-wide range →
          </Link>
        </p>
      ) : (
        <p className="mt-3 text-lg text-slate-700">
          We don&apos;t yet have enough {stateMatch.name} listings with published pay to quote a
          reliable range. See the {openings} open role{openings === 1 ? "" : "s"} below, or the{" "}
          <Link href={`/salary/${roleMatch.slug}`} className="text-navy-600 hover:underline">
            US-wide {roleMatch.label.toLowerCase()} pay range
          </Link>
          .
        </p>
      )}

      {hasFigures && stats && (
        <div className="mt-6">
          <SalaryFigures stats={stats} label={roleMatch.label} scope={`in ${stateMatch.name}`} />
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/jobs/state/${stateSlug(stateMatch.code)}/${roleMatch.slug}`}
          className="inline-block rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 shadow hover:bg-brass-500"
        >
          See open {roleMatch.label.toLowerCase()} jobs in {stateMatch.name} →
        </Link>
      </div>

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
