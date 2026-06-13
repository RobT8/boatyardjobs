import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminStats, type Bucket } from "@/lib/admin";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ROLE_LABEL = Object.fromEntries(ROLE_CATEGORIES.map((r) => [r.slug, r.label]));

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function BarList({
  title,
  items,
  relabel,
}: {
  title: string;
  items: Bucket[];
  relabel?: (s: string) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-navy-800">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li key={i.label} className="text-sm">
              <div className="flex justify-between text-slate-600">
                <span className="truncate pr-2">{relabel ? relabel(i.label) : i.label}</span>
                <span className="font-medium text-navy-800">{i.n}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                <div className="h-1.5 rounded bg-navy-600" style={{ width: `${(i.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const s = await getAdminStats();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy-800">Admin dashboard</h1>
        <form action="/api/admin/logout" method="post">
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Sign out
          </button>
        </form>
      </div>

      {/* Headline metrics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed subscribers" value={s.subscribers_confirmed} sub={`${s.subscribers_pending} awaiting confirm`} />
        <StatCard label="Apply clicks (total)" value={s.clicks_total} sub={`${s.clicks_7d} in last 7d · ${s.clicks_30d} in 30d`} />
        <StatCard label="Pageviews (total)" value={s.pageviews_total} sub={`${s.pageviews_7d} in last 7d · ${s.pageviews_30d} in 30d`} />
        <StatCard label="Live jobs" value={s.jobs_published} sub={`${s.jobs_pending} pending · ${s.jobs_expired} expired`} />
      </div>

      {/* Visitors */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Visitors</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <BarList title="Pageviews — last 14 days" items={s.pageviews_by_day.map((d) => ({ label: d.day, n: d.n }))} />
        <BarList title="Top referrers" items={s.top_referrers} />
        <BarList title="Top countries" items={s.top_countries} />
      </div>
      <div className="mt-3">
        <BarList title="Top pages" items={s.top_pages} />
      </div>

      {/* Subscribers */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Subscribers ({s.subscribers_total} total)</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <BarList title="By state" items={s.subscribers_by_state} relabel={(c) => US_STATES[c] ?? c} />
        <BarList title="By role" items={s.subscribers_by_category} relabel={(c) => ROLE_LABEL[c] ?? c} />
      </div>

      {/* Engagement */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Most-clicked jobs</h2>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        {s.top_clicked_jobs.length === 0 ? (
          <p className="text-sm text-slate-400">No apply clicks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Job</th>
                <th className="pb-2">Company</th>
                <th className="pb-2 text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {s.top_clicked_jobs.map((j, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-navy-800">{j.title}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{j.company}</td>
                  <td className="py-1.5 text-right font-medium text-navy-800">{j.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Jobs */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Jobs</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <BarList title="By source" items={s.jobs_by_source} />
        <BarList title="By role" items={s.jobs_by_category} relabel={(c) => ROLE_LABEL[c] ?? c} />
        <BarList title="By state (top)" items={s.jobs_by_state} relabel={(c) => US_STATES[c] ?? c} />
      </div>
    </div>
  );
}
