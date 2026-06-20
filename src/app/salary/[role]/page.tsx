import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AlertSignupForm from "@/components/AlertSignupForm";
import SalaryFigures from "@/components/SalaryFigures";
import { countByCategory } from "@/lib/jobs";
import { fmtAnnual, MIN_SAMPLE_FOR_STATS, salaryStats, statesWithSalary } from "@/lib/salary";
import { roleFromSlug, stateSlug, US_STATES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ role: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) return { title: "Not found" };
  const stats = await salaryStats(match.slug);
  const figure =
    stats && stats.n >= MIN_SAMPLE_FOR_STATS
      ? ` Median pay is around ${fmtAnnual(stats.median)} a year.`
      : "";
  return {
    title: `${match.label} Salary in the US`,
    description: `How much do ${match.label.toLowerCase()}s earn?${figure} Live pay ranges from open boatyard, marina and dealership listings, updated daily.`,
  };
}

/** schema.org Occupation markup — can earn an estimated-salary rich result.
 *  Only emitted with a credible sample. */
function occupationJsonLd(label: string, description: string, stats: NonNullable<Awaited<ReturnType<typeof salaryStats>>>) {
  return {
    "@context": "https://schema.org/",
    "@type": "Occupation",
    name: label,
    description,
    occupationLocation: { "@type": "Country", name: "United States" },
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

export default async function RoleSalaryPage({ params }: Props) {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) notFound();

  const [stats, byState, categoryCounts] = await Promise.all([
    salaryStats(match.slug),
    statesWithSalary(match.slug),
    countByCategory(),
  ]);
  const openings = categoryCounts.find((c) => c.category === match.slug)?.n ?? 0;
  const hasFigures = !!stats && stats.n >= 1;
  const confident = !!stats && stats.n >= MIN_SAMPLE_FOR_STATS;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {confident && stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(occupationJsonLd(match.label, match.description, stats)),
          }}
        />
      )}

      <nav className="text-sm text-slate-500">
        <Link href="/salary" className="hover:underline">Salaries</Link>
        {" / "}
        <span className="text-slate-700">{match.label}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-navy-800">
        {match.label} Salary in the US
      </h1>

      {hasFigures && stats ? (
        <p className="mt-3 text-lg text-slate-700">
          {match.label}s on BoatyardJobs earn a median of about{" "}
          <strong>{fmtAnnual(stats.median)}</strong> per year, with most roles paying between{" "}
          <strong>{fmtAnnual(stats.p25)}</strong> and <strong>{fmtAnnual(stats.p75)}</strong>.
        </p>
      ) : (
        <p className="mt-3 text-lg text-slate-700">
          Pay for {match.label.toLowerCase()}s varies widely by experience, certifications and
          region. We don&apos;t yet have enough listings with published pay to quote a reliable
          range — but there {openings === 1 ? "is" : "are"} {openings} open role
          {openings === 1 ? "" : "s"} below, many of which state their pay.
        </p>
      )}

      {hasFigures && stats && (
        <div className="mt-6">
          <SalaryFigures stats={stats} label={match.label} scope="nationwide" />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold text-navy-800">What affects {match.label.toLowerCase()} pay</h2>
        <p className="mt-3 leading-relaxed text-slate-700">{match.description}</p>
        <p className="mt-3 leading-relaxed text-slate-700">
          The biggest drivers are years of hands-on experience, the engine and systems brands you&apos;re
          certified on, and where you work — coastal hubs with year-round boating typically pay more.
          Manufacturer certifications (Mercury, Yamaha, Volvo Penta) and ABYC credentials reliably move
          pay toward the upper end of the range above.
        </p>
      </section>

      {byState.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-navy-800">{match.label} pay by state</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">State</th>
                  <th className="px-4 py-2 font-semibold">Median (annual)</th>
                  <th className="px-4 py-2 font-semibold">Listings</th>
                </tr>
              </thead>
              <tbody>
                {byState.map(({ state, stats: s }) => (
                  <tr key={state} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link
                        href={`/salary/${match.slug}/${stateSlug(state)}`}
                        className="font-medium text-navy-700 hover:underline"
                      >
                        {US_STATES[state] ?? state}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{fmtAnnual(s.median)}</td>
                    <td className="px-4 py-2 text-slate-400">{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/jobs/role/${match.slug}`}
          className="inline-block rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 shadow hover:bg-brass-500"
        >
          See {openings} open {match.label.toLowerCase()} job{openings === 1 ? "" : "s"} →
        </Link>
      </div>

      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">New {match.label.toLowerCase()} jobs by email</h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm category={match.slug} compact />
        </div>
      </div>
    </div>
  );
}
