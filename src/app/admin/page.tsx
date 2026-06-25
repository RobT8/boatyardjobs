import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminStats, type Bucket } from "@/lib/admin";
import { listEmployerLeads } from "@/lib/leads";
import { listDiscountCodes } from "@/lib/discounts";
import {
  getChannel,
  listActiveAds,
  listPendingCreatives,
  mrrCents,
  priceLabel,
} from "@/lib/ads";
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

interface Props {
  searchParams: Promise<{
    posted?: string;
    job_error?: string;
    discount_added?: string;
    discount_error?: string;
    discount_toggled?: string;
  }>;
}

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { posted, job_error, discount_added, discount_error, discount_toggled } =
    await searchParams;
  const [s, leads, pendingAds, activeAds, discounts] = await Promise.all([
    getAdminStats(),
    listEmployerLeads(),
    listPendingCreatives(),
    listActiveAds(),
    listDiscountCodes(),
  ]);
  const mrr = mrrCents(activeAds);

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

      {/* Employer leads */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">
        Employer leads ({leads.length})
      </h2>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        {leads.length === 0 ? (
          <p className="text-sm text-slate-400">No employer leads yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Company</th>
                <th className="pb-2">Contact</th>
                <th className="pb-2">Interest</th>
                <th className="pb-2">Listing</th>
                <th className="pb-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-2 font-medium text-navy-800">{l.company}</td>
                  <td className="py-1.5 pr-2 text-slate-600">
                    {l.contact_name ? `${l.contact_name} · ` : ""}
                    <a href={`mailto:${l.email}`} className="text-navy-600 hover:underline">
                      {l.email}
                    </a>
                    {l.phone ? ` · ${l.phone}` : ""}
                    {l.message ? (
                      <span className="block text-xs text-slate-400">{l.message}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-500">{l.interest}</td>
                  <td className="py-1.5 pr-2 text-slate-500">
                    {l.job_slug ? (
                      <a href={`/jobs/${l.job_slug}`} className="text-navy-600 hover:underline">
                        {l.job_title ?? l.job_slug}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 text-right text-slate-400">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Advertising */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">
        Advertising — {priceLabel(mrr)}/mo recurring
      </h2>

      {pendingAds.length > 0 && (
        <div className="mt-3 rounded-lg border border-brass-400 bg-amber-50/40 p-4">
          <h3 className="text-sm font-semibold text-navy-800">
            Awaiting approval ({pendingAds.length})
          </h3>
          <div className="mt-3 space-y-4">
            {pendingAds.map(({ creative, ad, advertiser }) => (
              <div
                key={creative.id}
                className="flex flex-wrap items-start gap-4 rounded-md border border-slate-200 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creative.image_url}
                  alt="Pending banner"
                  className="max-h-24 rounded border border-slate-200"
                />
                <div className="min-w-48 flex-1 text-sm">
                  <p className="font-medium text-navy-800">{advertiser.company}</p>
                  <p className="text-slate-500">
                    {ad.channels.map((c) => getChannel(c)?.label ?? c).join(" + ")}
                    {ad.target_state ? ` · ${ad.target_state}` : ""}
                    {ad.target_category ? ` · ${ad.target_category}` : ""}
                  </p>
                  <a
                    href={creative.target_url}
                    target="_blank"
                    rel="noopener"
                    className="break-all text-xs text-navy-600 hover:underline"
                  >
                    {creative.target_url}
                  </a>
                </div>
                <div className="flex gap-2">
                  <form action={`/api/admin/ads/${creative.id}`} method="post">
                    <input type="hidden" name="action" value="approve" />
                    <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                      Approve
                    </button>
                  </form>
                  <form action={`/api/admin/ads/${creative.id}`} method="post">
                    <input type="hidden" name="action" value="reject" />
                    <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-navy-800">Live & paused ads</h3>
        {activeAds.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No ads sold yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Advertiser</th>
                <th className="pb-2">Slots</th>
                <th className="pb-2">Plan</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Views</th>
                <th className="pb-2 text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {activeAds.map(({ ad, advertiser, stats }) => (
                <tr key={ad.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 font-medium text-navy-800">{advertiser.company}</td>
                  <td className="py-1.5 pr-2 text-slate-500">
                    {ad.channels.map((c) => getChannel(c)?.label ?? c).join(" + ")}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-500">
                    {ad.period_type === "recurring"
                      ? `${priceLabel(ad.price_cents)}/mo`
                      : `${priceLabel(ad.price_cents)} · ${ad.months}mo`}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-500">{ad.status}</td>
                  <td className="py-1.5 text-right text-navy-800">{stats.impressions}</td>
                  <td className="py-1.5 text-right text-navy-800">{stats.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Discount codes */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Discount codes</h2>

      {discount_added && (
        <p className="mt-3 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Discount code created.
        </p>
      )}
      {discount_toggled && (
        <p className="mt-3 rounded-md bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          Discount code updated.
        </p>
      )}
      {discount_error && (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Couldn&apos;t save that code — check it&apos;s unique, 2–40 letters/numbers, with a percentage 1–100.
        </p>
      )}

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        <form action="/api/admin/discounts" method="post" className="grid gap-3 sm:grid-cols-6">
          <input name="code" required placeholder="CODE" className="rounded-md border border-slate-300 px-3 py-2 text-sm uppercase sm:col-span-2" />
          <input name="percent_off" type="number" min="1" max="100" required placeholder="% off" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="applies_to" defaultValue="both" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="both">Jobs + ads</option>
            <option value="jobs">Jobs only</option>
            <option value="ads">Ads only</option>
          </select>
          <input name="max_uses" type="number" min="1" placeholder="Max uses (∞)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-brass-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500">
            Add code
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-3">
            Valid from
            <input name="valid_from" type="date" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-3">
            Valid until
            <input name="valid_until" type="date" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          </label>
        </form>

        {discounts.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Code</th>
                <th className="pb-2">Off</th>
                <th className="pb-2">Applies</th>
                <th className="pb-2">Window</th>
                <th className="pb-2 text-right">Used</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 font-mono font-medium text-navy-800">{d.code}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{d.percent_off}%</td>
                  <td className="py-1.5 pr-2 text-slate-500">{d.applies_to}</td>
                  <td className="py-1.5 pr-2 text-slate-500">
                    {d.valid_from ? new Date(d.valid_from).toLocaleDateString() : "—"}
                    {" → "}
                    {d.valid_until ? new Date(d.valid_until).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-1.5 text-right text-slate-600">
                    {d.used_count}
                    {d.max_uses != null ? ` / ${d.max_uses}` : ""}
                  </td>
                  <td className="py-1.5 text-right">
                    <form action="/api/admin/discounts" method="post" className="inline">
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                      <button
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          d.active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {d.active ? "active" : "off"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Jobs */}
      <h2 className="mt-10 text-lg font-bold text-navy-800">Jobs</h2>

      {posted && (
        <p className="mt-3 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Job posted — it&apos;s live now with a 30-day run.
        </p>
      )}
      {job_error && (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Couldn&apos;t post that job — please check the fields (description needs 30+ characters) and try again.
        </p>
      )}

      <details className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-navy-800">
          Post a job for a client
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          Posts a live, direct listing on a client&apos;s behalf (no payment). Add a client email to
          tie it to an employer account they can claim and renew later.
        </p>
        <form action="/api/admin/jobs" method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="Job title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="company" required placeholder="Company" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="city" required placeholder="City" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="state" required defaultValue="" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="" disabled>State…</option>
            {Object.entries(US_STATES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <select name="category" required defaultValue="" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="" disabled>Role…</option>
            {ROLE_CATEGORIES.map((r) => (
              <option key={r.slug} value={r.slug}>{r.label}</option>
            ))}
          </select>
          <input name="apply_email" type="email" required placeholder="Apply-to email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="salary_min" type="number" inputMode="numeric" placeholder="Salary min (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="salary_max" type="number" inputMode="numeric" placeholder="Salary max (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="salary_unit" defaultValue="YEAR" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="YEAR">per year</option>
            <option value="HOUR">per hour</option>
          </select>
          <input name="client_email" type="email" placeholder="Client account email (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" required rows={5} placeholder="Job description (30+ characters)" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" name="tier" value="featured" className="h-4 w-4 rounded border-slate-300" />
            Feature this listing (top of the board)
          </label>
          <button type="submit" className="justify-self-start rounded-md bg-brass-400 px-5 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500 sm:col-span-2">
            Post job for client
          </button>
        </form>
      </details>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <BarList title="By source" items={s.jobs_by_source} />
        <BarList title="By role" items={s.jobs_by_category} relabel={(c) => ROLE_LABEL[c] ?? c} />
        <BarList title="By state (top)" items={s.jobs_by_state} relabel={(c) => US_STATES[c] ?? c} />
      </div>
    </div>
  );
}
