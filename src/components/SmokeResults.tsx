import type { SmokeRun } from "@/lib/smoke";

/**
 * Latest automated smoke-suite result, shown at the top of the Launch tab.
 * Server component — just renders the row fetched in the admin page.
 */
export default function SmokeResults({ run }: { run: SmokeRun | null }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-800">Automated smoke suite</h2>
        {run && (
          <span className="text-xs text-slate-400">
            last run {new Date(run.created_at).toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Read-only Playwright checks of the core live flows (home, board, a job page + Apply,
        alerts, employer sign-in, post-a-job). Runs on a schedule; you&apos;re emailed if it fails.
      </p>

      {!run ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-400">
          No smoke run recorded yet. It appears here after the first scheduled run (or
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">npm run smoke:record</code>).
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                run.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {run.ok ? "✓ All passing" : `✕ ${run.failed} failing`}
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {run.passed} passed · {run.failed} failed · {run.skipped} skipped ·{" "}
              {(run.duration_ms / 1000).toFixed(1)}s
            </span>
            <a
              href={run.base_url}
              target="_blank"
              rel="noopener"
              className="ml-auto text-xs text-navy-600 hover:underline"
            >
              {run.base_url}
            </a>
          </div>

          {run.results.some((r) => r.status === "failed") && (
            <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {run.results
                .filter((r) => r.status === "failed")
                .map((r, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-red-700">✕ {r.title}</span>
                    {r.error && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-slate-400">
                        {r.error.split("\n")[0]}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
