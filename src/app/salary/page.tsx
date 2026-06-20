import type { Metadata } from "next";
import Link from "next/link";
import { fmtAnnual, MIN_SAMPLE_FOR_STATS, salaryStats } from "@/lib/salary";
import { ROLE_CATEGORIES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marine Trades Salary Guides",
  description:
    "How much do marine technicians, electricians, riggers and other boatyard trades earn? Live pay ranges from open US listings, updated daily.",
};

export default async function SalaryIndexPage() {
  const rows = await Promise.all(
    ROLE_CATEGORIES.map(async (role) => ({
      role,
      stats: await salaryStats(role.slug),
    }))
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">Marine Trades Salary Guides</h1>
      <p className="mt-3 text-slate-600">
        What the marine trades actually pay — computed from open listings on BoatyardJobs and
        updated as jobs come and go. Pick a trade for the full breakdown and pay by state.
      </p>

      <ul className="mt-8 space-y-3">
        {ROLE_CATEGORIES.map((role) => {
          const stats = rows.find((r) => r.role.slug === role.slug)?.stats;
          const confident = stats && stats.n >= MIN_SAMPLE_FOR_STATS;
          return (
            <li key={role.slug}>
              <Link
                href={`/salary/${role.slug}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 hover:border-navy-300 hover:bg-navy-50"
              >
                <span className="font-semibold text-navy-800">{role.label}</span>
                <span className="text-sm text-slate-500">
                  {confident && stats ? `Median ${fmtAnnual(stats.median)}/yr` : "View guide →"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
