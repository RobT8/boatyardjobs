import { getDb } from "@/lib/db";

/**
 * Latest automated smoke-suite run, for the Admin → Launch tab.
 * Written by `scripts/smoke/run.ts` (the smoke GitHub Action). Read-only here.
 */
export interface SmokeTestResult {
  title: string;
  status: "passed" | "failed" | "skipped";
  error?: string;
}

export interface SmokeRun {
  id: number;
  created_at: string;
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  base_url: string;
  results: SmokeTestResult[];
}

/**
 * Most recent smoke run, or null if none recorded yet / the table doesn't exist.
 * Deliberately swallows errors so a missing `smoke_runs` table never breaks the
 * admin page.
 */
export async function getLatestSmokeRun(): Promise<SmokeRun | null> {
  try {
    const { data, error } = await getDb()
      .from("smoke_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as SmokeRun;
  } catch {
    return null;
  }
}
