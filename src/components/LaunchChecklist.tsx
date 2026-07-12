"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Interactive pre-launch checklist for the Admin → Launch tab. Mirrors
 * docs/LAUNCH-TEST-PLAN.md. Manual tick state persists in localStorage (single
 * admin), so it survives reloads without a DB round-trip.
 */

type Pri = "P0" | "P1" | "P2";
type Status = "none" | "pass" | "fail";
interface Item {
  id: string;
  pri: Pri;
  txt: string;
  crit?: string;
}
interface Section {
  code: string;
  title: string;
  items: Item[];
}

const DATA: Section[] = [
  {
    code: "1",
    title: "Pre-flight — environment & config",
    items: [
      { id: "1.1", pri: "P0", txt: "Stripe LIVE keys set in Vercel", crit: "Confirm live, not test-mode keys" },
      { id: "1.2", pri: "P0", txt: "Stripe webhook endpoint = www host", crit: "Apex 308 is NOT followed by Stripe — bare domain silently breaks paid publishing" },
      { id: "1.3", pri: "P0", txt: "Webhook signing secret matches dashboard", crit: "STRIPE_WEBHOOK_SECRET in Vercel == endpoint's secret" },
      { id: "1.4", pri: "P0", txt: "Webhook subscribed to the 4 handled events", crit: "checkout.session.completed, invoice.payment_succeeded/failed, customer.subscription.deleted" },
      { id: "1.5", pri: "P0", txt: "Supabase URL + service-role key in Vercel & Actions", crit: "DB-backed pages 500 without them" },
      { id: "1.6", pri: "P0", txt: "All HANDOVER migrations applied to prod DB", crit: "listing_rank, expiry_warned_at, address, discount_codes, alerts.city, badge tables, smoke_runs" },
      { id: "1.7", pri: "P1", txt: "Resend domain authenticated (SPF/DKIM/DMARC)", crit: "Else mail lands in spam or is rejected" },
      { id: "1.8", pri: "P1", txt: "SITE_URL = www everywhere (Vercel + every Actions secret)", crit: "Sitemap, canonicals, email links, indexing pings" },
      { id: "1.9", pri: "P1", txt: "Secrets present in aggregate / digest / badge-verify / smoke workflows", crit: "LEADS_NOTIFY_EMAIL powers badge + smoke alerts" },
      { id: "1.10", pri: "P2", txt: "Google Indexing WIF providers intact", crit: "SEO fast-lane; falls back to organic crawl if dark" },
    ],
  },
  {
    code: "2",
    title: "Static checks (run on the branch)",
    items: [
      { id: "2.1", pri: "P1", txt: "tsc --noEmit clean" },
      { id: "2.2", pri: "P1", txt: "eslint clean" },
      { id: "2.3", pri: "P1", txt: "npm test green", crit: "parser + JSON-LD + badge suites" },
      { id: "2.4", pri: "P1", txt: "next build completes, no route errors" },
      { id: "2.5", pri: "P2", txt: "Broken-link sweep across all page types", crit: "Nav, footer, in-content, role/state/city cross-links" },
      { id: "2.6", pri: "P1", txt: "Console-error sweep", crit: "Zero uncaught JS / failed calls / hydration warnings" },
    ],
  },
  {
    code: "A",
    title: "Candidate / job-seeker journey",
    items: [
      { id: "A2", pri: "P0", txt: "Board orders featured → direct → scraped", crit: "listing_rank; pagination works" },
      { id: "A3", pri: "P1", txt: "Search + filter + sort", crit: "Role/state/city filters correct; empty search handled" },
      { id: "A4", pri: "P0", txt: "Job detail renders fully", crit: "Company links to /employers/[id] for direct; paragraphs; salary; share" },
      { id: "A5", pri: "P0", txt: "Apply click routes + is tracked", crit: "Scraped→source_url · direct→mailto · else ?apply=direct. Count is the employer metric" },
      { id: "A7", pri: "P1", txt: "SEO landing pages unique & non-thin", crit: "role / state / state×role / city / city×role; 0-inventory combos not indexed" },
      { id: "A8", pri: "P1", txt: "Salary pages render + Occupation JSON-LD" },
      { id: "A10", pri: "P1", txt: "Public employer pages, two-tier", crit: "[id] 404s with no live jobs; static routes win over [id]" },
      { id: "A11", pri: "P1", txt: "404 / bad slug is friendly", crit: "No stack trace" },
    ],
  },
  {
    code: "B",
    title: "Job alerts",
    items: [
      { id: "B1", pri: "P1", txt: "Compact signup → confirm email" },
      { id: "B2", pri: "P1", txt: "Full multi state/city × multi role signup", crit: "Fans out per (location×role), capped 200" },
      { id: "B3", pri: "P1", txt: "Double opt-in confirm works" },
      { id: "B4", pri: "P1", txt: "One-click unsubscribe, no login, idempotent" },
      { id: "B5", pri: "P1", txt: "Digest sends only new matching jobs", crit: "Canonical city/state match; unconfirmed get nothing" },
    ],
  },
  {
    code: "C",
    title: "Employer journey",
    items: [
      { id: "C1", pri: "P1", txt: "Register — no duplicate-email crash" },
      { id: "C2", pri: "P1", txt: "Magic-link login", crit: "Single-use / expiring token" },
      { id: "C3", pri: "P1", txt: "Password login", crit: "Wrong password rejected" },
      { id: "C5", pri: "P0", txt: "Post-a-job wizard validates + builds checkout", crit: "Incl. step-1 street/postal capture" },
      { id: "C6", pri: "P0", txt: "Pay → job publishes", crit: "Webhook publishes, sets 30-day expiry, success page, appears on board" },
      { id: "C7", pri: "P0", txt: "100%-off / free path publishes without charge", crit: "No dangling unpaid row" },
      { id: "C8", pri: "P1", txt: "Dashboard shows jobs, statuses, apply counts, expiry" },
      { id: "C10", pri: "P1", txt: "Feature-a-job upgrade charges + promotes", crit: "Jumps to featured tier + carousel" },
      { id: "C11", pri: "P0", txt: "Renew (session OR ?token=) extends expiry", crit: "Clears expiry_warned_at; one-click email works" },
      { id: "C12", pri: "P1", txt: "Expiry warning email (5 days)", crit: "Working one-click renew; not re-sent unless re-expiring" },
      { id: "C13", pri: "P1", txt: "Auto-expire sweep drops job off board", crit: "Evergreen null-expiry listings untouched" },
      { id: "C14", pri: "P1", txt: "We're Hiring badge SVG + live count", crit: "404s unknown id; edge-cached" },
    ],
  },
  {
    code: "D",
    title: "Advertiser journey",
    items: [
      { id: "D1", pri: "P1", txt: "Advertise pages + auth mirror employer" },
      { id: "D2", pri: "P1", txt: "Creative upload + link render in SponsorSlot", crit: "Image to Supabase storage" },
      { id: "D3", pri: "P0", txt: "Fixed-term ad checkout activates ad", crit: "kind=ad → success page" },
      { id: "D4", pri: "P0", txt: "Monthly subscription: success / fail / cancel all handled", crit: "invoice.succeeded · invoice.failed · subscription.deleted" },
      { id: "D5", pri: "P0", txt: "Ad renewal extends", crit: "kind=ad_renew; token path" },
      { id: "D6", pri: "P1", txt: "Ad click tracking redirects + counts" },
      { id: "D7", pri: "P1", txt: "Dashboard + Stripe billing portal open" },
      { id: "D8", pri: "P1", txt: "Advertiser expiry warning (7 days) + renew" },
      { id: "D9", pri: "P1", txt: "Active ads only shown; no broken image" },
    ],
  },
  {
    code: "E",
    title: "Admin",
    items: [
      { id: "E1", pri: "P1", txt: "Admin auth gate holds; logout works", crit: "Wrong creds rejected" },
      { id: "E2", pri: "P1", txt: "Post-a-job-for-client (no Stripe)", crit: "Indexing ping fires" },
      { id: "E3", pri: "P1", txt: "Discount codes: %, window, cap, scope", crit: "Shows in list" },
      { id: "E4", pri: "P1", txt: "Ads admin approve / edit / deactivate" },
      { id: "E5", pri: "P1", txt: "Enhanced-profile toggle flips public page", crit: "Badge-deal status lights" },
      { id: "E6", pri: "P2", txt: "Manual badge verify reports present/missing" },
      { id: "E7", pri: "P2", txt: "Subscriber list renders chips + dates" },
      { id: "E8", pri: "P1", txt: "Employer leads stored + notified" },
    ],
  },
  {
    code: "F",
    title: "Payments & money — deep dive",
    items: [
      { id: "F1", pri: "P0", txt: "New job: charge → published, correct expiry, receipt" },
      { id: "F2", pri: "P0", txt: "Renewal: expiry extended, warned flag cleared" },
      { id: "F3", pri: "P0", txt: "Featured upgrade charge → featured + carousel" },
      { id: "F4", pri: "P0", txt: "Fixed-term ad active for term" },
      { id: "F5", pri: "P0", txt: "Ad renewal extends" },
      { id: "F6", pri: "P0", txt: "Monthly sub happy path activates + portal shows it" },
      { id: "F7", pri: "P0", txt: "Monthly sub failed renewal handled, no crash" },
      { id: "F8", pri: "P0", txt: "Monthly sub cancelled → ad deactivates cleanly" },
      { id: "F9", pri: "P0", txt: "Discount applied correctly; scope enforced; count only on payment", crit: "Expired/maxed code rejected" },
      { id: "F10", pri: "P0", txt: "Webhook idempotent on Stripe re-delivery", crit: "No double-publish / double-count" },
      { id: "F11", pri: "P0", txt: "Abandoned checkout leaves no ghost", crit: "Stays unpaid, never live" },
      { id: "F12", pri: "P0", txt: "Bad/missing signature → 400, not processed" },
      { id: "F13", pri: "P1", txt: "Refund test transactions; decide unpublish-on-refund" },
    ],
  },
  {
    code: "G",
    title: "Scheduled jobs / crons",
    items: [
      { id: "G1", pri: "P1", txt: "aggregate: scrape all sources, upsert, expire, ping" },
      { id: "G2", pri: "P1", txt: "One broken feed fails soft, doesn't abort run" },
      { id: "G3", pri: "P1", txt: "digest: alerts + employer + advertiser expiry send" },
      { id: "G4", pri: "P1", txt: "badge-verify: transient errors never flip to missing", crit: "Missing → one email, re-arms on recovery" },
      { id: "G5", pri: "P2", txt: "Salary re-parse improves coverage, no bad figures" },
    ],
  },
  {
    code: "H",
    title: "SEO & structured data",
    items: [
      { id: "H1", pri: "P1", txt: "JobPosting JSON-LD valid; validThrough always; escaped", crit: "No script-tag breakout" },
      { id: "H2", pri: "P2", txt: "BreadcrumbList on city×role valid + escaped" },
      { id: "H3", pri: "P2", txt: "Occupation on salary pages valid" },
      { id: "H4", pri: "P1", txt: "Organization + WebSite logo canonical" },
      { id: "H5", pri: "P2", txt: "Unique meta titles/descriptions, no dupes" },
      { id: "H6", pri: "P1", txt: "Canonicals + metadataBase all www" },
      { id: "H7", pri: "P1", txt: "Sitemap: live-inventory only, no 404s" },
      { id: "H8", pri: "P2", txt: "OG / Twitter cards correct" },
    ],
  },
  {
    code: "I",
    title: "Cross-cutting quality",
    items: [
      { id: "I1", pri: "P1", txt: "Responsive 360 / 768 / 1280", crit: "No h-scroll; ≥44px taps; touch submenu; carousel swipes" },
      { id: "I2", pri: "P1", txt: "Accessibility: keyboard, focus, labels, contrast", crit: "Lighthouse a11y ≥90" },
      { id: "I3", pri: "P2", txt: "Performance bar realistic (force-dynamic, CDN TTFB)" },
      { id: "I4", pri: "P0", txt: "Forms: server-side validation, upload limits, double-submit", crit: "Not client-only validation" },
      { id: "I5", pri: "P1", txt: "Empty & error states graceful", crit: "Zero-result, no-jobs, no-ads, 500 fallback, Stripe/Resend outage" },
      { id: "I6", pri: "P0", txt: "Security: httpOnly cookies, single-use tokens, admin gate, no key leak", crit: "Rate-limit magic-link + leads; upload can't store non-images" },
      { id: "I7", pri: "P1", txt: "Analytics: apply/ad-click counts accurate, not bot-inflated", crit: "These numbers go to employers" },
      { id: "I8", pri: "P1", txt: "Legal: privacy, terms, unsubscribe in every email, cookie notice" },
      { id: "I9", pri: "P2", txt: "Cross-browser: Chrome/Safari/Firefox/Edge, iOS/Android" },
    ],
  },
];

const KEY = "byj-launch-run-v1";
const ALL_ITEMS = DATA.flatMap((s) => s.items);

const PRI_CLS: Record<Pri, string> = {
  P0: "text-red-700 border-red-300 bg-red-50",
  P1: "text-amber-700 border-amber-300 bg-amber-50",
  P2: "text-slate-500 border-slate-300 bg-slate-50",
};

type Filter = "all" | "P0" | "open";

export default function LaunchChecklist() {
  const [state, setState] = useState<Record<string, Status>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load persisted ticks from localStorage after mount. Deferring to an effect
    // (rather than a lazy initializer) keeps the server-rendered HTML and the
    // first client render identical, so there's no hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is browser-only and can't be read during SSR */
    try {
      setState(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
    } catch {
      /* ignore */
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function persist(next: Record<string, Status>) {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function cycle(id: string) {
    const cur = state[id] ?? "none";
    const nextStatus: Status = cur === "none" ? "pass" : cur === "pass" ? "fail" : "none";
    const next = { ...state };
    if (nextStatus === "none") delete next[id];
    else next[id] = nextStatus;
    persist(next);
  }

  const stats = useMemo(() => {
    const by = (pri: Pri) => {
      const items = ALL_ITEMS.filter((i) => i.pri === pri);
      return { pass: items.filter((i) => state[i.id] === "pass").length, total: items.length };
    };
    const pass = ALL_ITEMS.filter((i) => state[i.id] === "pass").length;
    const fail = ALL_ITEMS.filter((i) => state[i.id] === "fail").length;
    const p0 = by("P0");
    return {
      p0,
      p1: by("P1"),
      p2: by("P2"),
      pass,
      fail,
      total: ALL_ITEMS.length,
      go: p0.pass === p0.total && fail === 0,
    };
  }, [state]);

  if (!loaded) return <div className="mt-6 text-sm text-slate-400">Loading checklist…</div>;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-800">Pre-launch checklist</h2>
        <button
          onClick={() => {
            if (confirm("Clear all pass/fail marks for this test run?")) persist({});
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-red-300 hover:text-red-600"
        >
          Reset run
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Companion to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">docs/LAUNCH-TEST-PLAN.md</code>.
        Click a box to cycle untested → <span className="text-emerald-700">pass</span> →{" "}
        <span className="text-red-600">fail</span>. Saved in this browser.
      </p>

      {/* Status board */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tally label="P0" pass={stats.p0.pass} total={stats.p0.total} dot="bg-red-500" />
          <Tally label="P1" pass={stats.p1.pass} total={stats.p1.total} dot="bg-amber-500" />
          <Tally label="P2" pass={stats.p2.pass} total={stats.p2.total} dot="bg-slate-400" />
          <div className="ml-auto min-w-[200px] flex-1">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Overall verified</span>
              <span className="font-semibold tabular-nums text-navy-800">
                {Math.round((stats.pass / stats.total) * 100)}%
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-emerald-500" style={{ width: `${(stats.pass / stats.total) * 100}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${(stats.fail / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {(["all", "P0", "open"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                filter === f ? "bg-navy-800 text-white" : "border border-slate-300 text-slate-600 hover:border-brass-400"
              }`}
            >
              {f === "all" ? "All" : f === "P0" ? "P0 only" : "Unverified & fails"}
            </button>
          ))}
        </div>
      </div>

      {/* Gate */}
      <div
        className={`mt-4 flex items-center gap-3 rounded-lg border p-4 text-sm font-medium ${
          stats.go ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"
        }`}
      >
        <span className="text-xl">{stats.go ? "🚢" : "⚓"}</span>
        <div>
          <b>{stats.go ? "GO" : "NO-GO"}</b>
          {" — "}
          {stats.go
            ? "All P0 verified and nothing failing. Clear P1s or sign them off, then launch."
            : stats.fail > 0
              ? `${stats.fail} case${stats.fail > 1 ? "s" : ""} failing · ${stats.p0.total - stats.p0.pass} P0 unverified.`
              : `${stats.p0.total - stats.p0.pass} P0 case${stats.p0.total - stats.p0.pass !== 1 ? "s" : ""} still unverified.`}
          <span className="mt-0.5 block font-normal text-slate-500">
            The gate opens only when every P0 passes and no case is failing.
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-4 space-y-3">
        {DATA.map((sec) => {
          const passN = sec.items.filter((i) => state[i.id] === "pass").length;
          const failN = sec.items.filter((i) => state[i.id] === "fail").length;
          const rows = sec.items.filter(
            (it) =>
              filter === "all" ||
              (filter === "P0" && it.pri === "P0") ||
              (filter === "open" && state[it.id] !== "pass"),
          );
          if (rows.length === 0) return null;
          return (
            <details key={sec.code} open className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-md bg-navy-800 font-mono text-xs font-bold text-white">
                  {sec.code}
                </span>
                <span className="flex-1 font-semibold text-navy-800">{sec.title}</span>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {passN}/{sec.items.length}
                </span>
                <span className="flex h-1.5 w-12 flex-none overflow-hidden rounded-full bg-slate-200">
                  <span className="h-full bg-emerald-500" style={{ width: `${(passN / sec.items.length) * 100}%` }} />
                  <span className="h-full bg-red-500" style={{ width: `${(failN / sec.items.length) * 100}%` }} />
                </span>
              </summary>
              <div className="border-t border-slate-100">
                {rows.map((it) => {
                  const st = state[it.id] ?? "none";
                  return (
                    <div key={it.id} className="flex items-start gap-3 border-b border-slate-50 px-3.5 py-3 last:border-b-0">
                      <button
                        onClick={() => cycle(it.id)}
                        aria-label={`Toggle ${it.id}`}
                        className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md border-2 text-sm font-bold text-white transition ${
                          st === "pass"
                            ? "border-emerald-500 bg-emerald-500"
                            : st === "fail"
                              ? "border-red-500 bg-red-500"
                              : "border-slate-300 bg-white hover:border-brass-400"
                        }`}
                      >
                        {st === "pass" ? "✓" : st === "fail" ? "✕" : ""}
                      </button>
                      <div className={`flex-1 ${st === "pass" ? "opacity-55" : ""}`}>
                        <span className="text-sm text-navy-800">
                          <span className="mr-1.5 font-mono text-xs font-bold text-brass-500">{it.id}</span>
                          {it.txt}
                        </span>
                        {it.crit && <span className="mt-0.5 block text-xs text-slate-500">{it.crit}</span>}
                      </div>
                      <span className={`flex-none rounded border px-1.5 py-1 font-mono text-[10px] font-bold ${PRI_CLS[it.pri]}`}>
                        {it.pri}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Tally({ label, pass, total, dot }: { label: string; pass: number; total: number; dot: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label} <span className="tabular-nums">{pass}/{total}</span>
    </span>
  );
}
