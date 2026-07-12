/**
 * Smoke-suite runner (used by the `smoke` GitHub Action and `npm run smoke:record`).
 *
 * 1. Runs the Playwright smoke suite against SMOKE_BASE_URL with the JSON reporter.
 * 2. Summarises pass/fail per test.
 * 3. Records the run in the `smoke_runs` table so the Admin → Launch tab can show it.
 * 4. Emails LEADS_NOTIFY_EMAIL (falls back to ADMIN_EMAIL) if anything failed.
 *
 * Exit code mirrors the suite (non-zero on failure) so CI goes red — but only
 * AFTER the DB write + email, so you always get the alert.
 *
 * Plain `npm run smoke` just runs Playwright with no DB/email side effects.
 */
import { spawnSync } from "node:child_process";
import { getDb } from "../../src/lib/db";
import { sendEmail, isEmailEnabled, adminNotifyEmail, smokeFailureHtml } from "../../src/lib/email";

interface TestResult {
  title: string;
  status: "passed" | "failed" | "skipped";
  error?: string;
}

interface Summary {
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  baseUrl: string;
  results: TestResult[];
}

/** Minimal shape of the Playwright JSON report (only the fields we read). */
interface PwResult {
  status: string;
  error?: { message?: string };
}
interface PwSpec {
  title: string;
  ok: boolean;
  tests?: { results?: PwResult[] }[];
}
interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  suites?: PwSuite[];
  stats?: { unexpected?: number; duration?: number };
}

/** Walk Playwright's nested JSON report into a flat list of specs. */
function collect(suites: PwSuite[] | undefined, acc: TestResult[] = []): TestResult[] {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const statuses = (spec.tests ?? []).flatMap((t) =>
        (t.results ?? []).map((r) => r.status),
      );
      const status: TestResult["status"] = spec.ok
        ? statuses.every((s) => s === "skipped")
          ? "skipped"
          : "passed"
        : "failed";
      const error =
        status === "failed"
          ? (spec.tests ?? [])
              .flatMap((t) => t.results ?? [])
              .map((r) => r.error?.message)
              .find(Boolean)
          : undefined;
      acc.push({ title: spec.title, status, error: error ? stripAnsi(String(error)).slice(0, 500) : undefined });
    }
    if (suite.suites) collect(suite.suites, acc);
  }
  return acc;
}

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, "");
}

async function main() {
  const baseUrl = (process.env.SMOKE_BASE_URL ?? "https://www.boatyardjobs.com").replace(/\/$/, "");
  console.log(`Running smoke suite against ${baseUrl}\n`);

  const run = spawnSync(
    "npx",
    ["playwright", "test", "--reporter=json"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: process.env.CI ?? "1" } },
  );

  let report: PwReport;
  try {
    report = JSON.parse(run.stdout) as PwReport;
  } catch {
    console.error("Could not parse Playwright JSON output. Raw stderr:\n", run.stderr?.slice(0, 2000));
    process.exit(run.status ?? 1);
  }

  const results = collect(report.suites);
  const summary: Summary = {
    ok: (report.stats?.unexpected ?? 0) === 0,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    durationMs: Math.round(report.stats?.duration ?? 0),
    baseUrl,
    results,
  };

  // Human summary
  for (const r of results) {
    const mark = r.status === "passed" ? "✓" : r.status === "skipped" ? "–" : "✗";
    console.log(`  ${mark} ${r.title}${r.error ? `\n      ${r.error.split("\n")[0]}` : ""}`);
  }
  console.log(
    `\n${summary.ok ? "PASS" : "FAIL"} — ${summary.passed} passed, ${summary.failed} failed, ` +
      `${summary.skipped} skipped in ${(summary.durationMs / 1000).toFixed(1)}s`,
  );

  // Record in the DB (best-effort — never let a logging failure mask the result).
  try {
    await getDb()
      .from("smoke_runs")
      .insert({
        ok: summary.ok,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        duration_ms: summary.durationMs,
        base_url: summary.baseUrl,
        results: summary.results,
      });
    console.log("Recorded run in smoke_runs.");
  } catch (e) {
    console.warn("Could not record smoke run (table missing or DB unset):", (e as Error).message);
  }

  // Alert on failure.
  if (!summary.ok) {
    const to = adminNotifyEmail();
    if (isEmailEnabled() && to) {
      try {
        await sendEmail({
          to,
          subject: `⚠️ BoatyardJobs smoke suite FAILED — ${summary.failed} check(s) down`,
          html: smokeFailureHtml(summary),
        });
        console.log(`Alert emailed to ${to}.`);
      } catch (e) {
        console.error("Failed to send alert email:", (e as Error).message);
      }
    } else {
      console.warn("No alert sent (RESEND_API_KEY and/or LEADS_NOTIFY_EMAIL not set).");
    }
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
