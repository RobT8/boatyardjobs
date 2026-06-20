import { fmtAnnual, fmtHourly, MIN_SAMPLE_FOR_STATS, type SalaryStats } from "@/lib/salary";

/** Three-card salary breakdown (25th / median / 75th) shared by the national and
 *  state salary pages. `scope` is a phrase like "nationwide" or "in Florida". */
export default function SalaryFigures({
  stats,
  label,
  scope,
}: {
  stats: SalaryStats;
  label: string;
  scope: string;
}) {
  const cards = [
    { k: "Entry · 25th pct", a: stats.p25, h: stats.hourlyP25, hi: false },
    { k: "Median", a: stats.median, h: stats.hourlyMedian, hi: true },
    { k: "Experienced · 75th pct", a: stats.p75, h: stats.hourlyP75, hi: false },
  ];
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.k}
            className={`rounded-lg border p-5 ${
              c.hi ? "border-brass-400 bg-amber-50/50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.k}</p>
            <p className="mt-1 text-2xl font-bold text-navy-800">{fmtAnnual(c.a)}</p>
            <p className="text-sm text-slate-500">≈ {fmtHourly(c.h)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Based on {stats.n} {label.toLowerCase()} listing{stats.n === 1 ? "" : "s"} {scope} with
        published pay on BoatyardJobs.
        {stats.n < MIN_SAMPLE_FOR_STATS && " Small sample — treat as indicative."} Hourly figures
        are derived from annual pay (≈2,080 hrs/yr).
      </p>
    </div>
  );
}
