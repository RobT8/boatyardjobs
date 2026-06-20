import { getDb } from "./db";

/**
 * Annual figures below this are almost certainly hourly rates that leaked in
 * with the wrong unit (a known upstream parsing quirk — every salaried row is
 * stored as YEAR, and a handful arrive as bare single/double-digit values).
 * Excluded from the stats so a salary page never prints an absurd "$5/yr".
 */
export const MIN_CREDIBLE_ANNUAL = 15000;

/** Minimum salaried listings before we'll publish a computed figure rather than
 *  fall back to editorial copy. */
export const MIN_SAMPLE_FOR_STATS = 6;

/** Rough annual↔hourly conversion (40h × 52w). */
const HOURS_PER_YEAR = 2080;

export interface SalaryStats {
  /** Number of credible salaried listings the figures are based on. */
  n: number;
  /** 25th-percentile low, median midpoint, 75th-percentile high — annual USD. */
  p25: number;
  median: number;
  p75: number;
  /** Derived hourly equivalents (annual ÷ 2080), rounded. */
  hourlyP25: number;
  hourlyMedian: number;
  hourlyP75: number;
}

interface SalaryRow {
  salary_min: number | null;
  salary_max: number | null;
}

/** Linear-interpolated percentile of an ascending-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute robust salary stats from raw rows. Uses 25th-percentile *low*, median
 * *midpoint* and 75th-percentile *high* so a few outliers can't skew the range,
 * after dropping the sub-$15k junk values. Returns null if nothing credible.
 */
export function statsFromRows(rows: SalaryRow[]): SalaryStats | null {
  const los: number[] = [];
  const mids: number[] = [];
  const his: number[] = [];
  for (const r of rows) {
    const lo = r.salary_min ?? r.salary_max;
    const hi = r.salary_max ?? r.salary_min;
    if (lo == null || hi == null) continue;
    if (lo < MIN_CREDIBLE_ANNUAL) continue;
    los.push(lo);
    his.push(hi);
    mids.push((lo + hi) / 2);
  }
  if (los.length === 0) return null;
  los.sort((a, b) => a - b);
  his.sort((a, b) => a - b);
  mids.sort((a, b) => a - b);

  const p25 = Math.round(percentile(los, 0.25));
  const median = Math.round(percentile(mids, 0.5));
  const p75 = Math.round(percentile(his, 0.75));
  const hr = (n: number) => Math.round(n / HOURS_PER_YEAR);
  return {
    n: los.length,
    p25,
    median,
    p75,
    hourlyP25: hr(p25),
    hourlyMedian: hr(median),
    hourlyP75: hr(p75),
  };
}

/** Live salary stats for a role, optionally scoped to a state. */
export async function salaryStats(role: string, state?: string): Promise<SalaryStats | null> {
  let query = getDb()
    .from("jobs")
    .select("salary_min, salary_max")
    .eq("status", "published")
    .eq("category", role);
  if (state) query = query.eq("state", state.toUpperCase());
  const { data, error } = await query;
  if (error) throw error;
  return statsFromRows((data ?? []) as SalaryRow[]);
}

export interface StateSalary {
  state: string;
  stats: SalaryStats;
}

/**
 * States with at least `minN` credible salaried listings for a role, busiest
 * first. Drives the state-level salary pages and their sitemap entries.
 */
export async function statesWithSalary(role: string, minN = MIN_SAMPLE_FOR_STATS): Promise<StateSalary[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("state, salary_min, salary_max")
    .eq("status", "published")
    .eq("category", role);
  if (error) throw error;

  const byState = new Map<string, SalaryRow[]>();
  for (const r of (data ?? []) as (SalaryRow & { state: string | null })[]) {
    if (!r.state) continue;
    const arr = byState.get(r.state) ?? [];
    arr.push(r);
    byState.set(r.state, arr);
  }

  const out: StateSalary[] = [];
  for (const [state, rows] of byState) {
    const stats = statsFromRows(rows);
    if (stats && stats.n >= minN) out.push({ state, stats });
  }
  return out.sort((a, b) => b.stats.n - a.stats.n);
}

/** Format an annual USD figure as e.g. "$57,800". */
export function fmtAnnual(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Format a derived hourly figure as e.g. "$28/hr". */
export function fmtHourly(n: number): string {
  return `$${n}/hr`;
}
