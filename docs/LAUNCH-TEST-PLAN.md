# BoatyardJobs — Pre-Launch Test & Review Plan

> **Purpose:** the single go-live checklist. Every process on the site is mapped
> to concrete test cases with pass criteria, prioritised by risk. Work top to
> bottom; nothing ships to "advertise to employers" until every **P0** passes.
>
> **Owner:** Rob · **Target:** full public launch + employer advertising push
> **Status legend per case:** ☐ not run · ◪ in progress · ☑ pass · ✗ fail (log a ticket)

---

## 0. How to read this plan

This is **risk-based**, not exhaustive-for-its-own-sake. Priorities:

| Pri | Meaning | Go-live rule |
|-----|---------|--------------|
| **P0** | Money, data loss, or "employer pays and gets nothing" | **Must pass.** A single P0 fail blocks launch. |
| **P1** | Core journey broken but no money lost (e.g. alert email never arrives) | Must pass, or ship with a documented workaround + owner sign-off. |
| **P2** | Polish, edge cases, SEO niceties | Track, fix post-launch if needed. |

**Golden rule for this site:** the two things that must be *bulletproof* before
you invite employers are (1) **an employer can pay and their job goes live**, and
(2) **a job seeker can find that job and click Apply**. Everything else supports
those two. Test them first, test them last, test them on real production.

**Test on the real deploy.** Per `docs/HANDOVER.md` the apex 308-redirects to
`www.` and a CDN sits in front. Always test against `https://www.boatyardjobs.com`
(canonical) **and** the raw `*.vercel.app` URL to separate app bugs from edge-cache
bugs. Purge the CDN after any content-affecting deploy before re-checking.

---

## 1. Pre-flight — environment & configuration (do this FIRST)

Config mistakes here cause silent, expensive failures (employer pays, webhook
never fires, job never publishes). Verify every item **in the live Vercel + GitHub
Actions environment**, not just locally.

### 1.1 Stripe (P0 — highest financial risk)
- ☐ Live mode keys set in Vercel (`STRIPE_SECRET_KEY`, publishable key). Confirm **live**, not test.
- ☐ **Webhook endpoint in the Stripe dashboard points at `https://www.boatyardjobs.com/api/stripe/webhook`** — the `www` host, not the bare apex. *(HANDOVER flags this as still-open: Stripe does NOT follow the apex 308, so a bare-domain endpoint silently breaks paid publishing.)*
- ☐ Webhook signing secret (`STRIPE_WEBHOOK_SECRET`) in Vercel matches the dashboard endpoint's secret.
- ☐ Webhook subscribed to the events the code handles: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`.
- ☐ Product/price setup correct for: direct job post, job renewal, fixed-term ad, **monthly ad subscription**, featured upgrade.

### 1.2 Supabase (P0)
- ☐ `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in Vercel and in each GitHub Actions workflow that needs DB.
- ☐ All migrations noted in HANDOVER are actually applied to prod project `zpesevmnmaifnooqiyrr` (they live only in the DB, not the repo). Spot-check the columns/tables: `jobs.listing_rank`, `jobs.expiry_warned_at`, `jobs.street_address/postal_code`, `ads.expiry_warned_at`, `discount_codes`, `alerts.city`, `employers.enhanced_profile/about`, `badge_placements`.
- ☐ Run Supabase **advisors** (security + performance) and clear anything critical.

### 1.3 Email — Resend (P1, P0 for payment receipts if any)
- ☐ `RESEND_API_KEY`, `ALERTS_FROM_EMAIL`, `LEADS_NOTIFY_EMAIL`, `SITE_URL` set in Vercel **and** in `digest.yml` / `badge-verify.yml` / `smoke.yml`.
- ☐ Sending domain verified in Resend (SPF, DKIM, DMARC records live on the DNS). Without this, mail lands in spam or is rejected.
- ☐ `SITE_URL` = the **www** value everywhere (Vercel env + every Actions secret) — HANDOVER 2026-07-07.

### 1.4 Domain / SEO infra (P1)
- ☐ `www` is canonical; apex 308→www confirmed.
- ☐ `robots.ts` allows crawl of public pages, sitemap pointer uses www.
- ☐ `sitemap.ts` returns 200 and lists jobs, employer pages, salary + role×city landing pages.
- ☐ Google Search Console verified; Indexing API service account still an **Owner** of the property (HANDOVER: keyless WIF, t80.dev GCP account).
- ☐ Favicon/icon set serving (icon.svg, favicon.ico, apple-icon, /logo.png).

### 1.5 Google Indexing / GCP (P2 — SEO fast-lane, not launch-blocking)
- ☐ WIF providers intact (`github-actions` cron + `vercel` runtime); `GCP_*` vars present. If dark, launch still fine — indexing just falls back to organic crawl.

### 1.6 Secrets present for each GitHub Actions workflow (P1)
- ☐ `aggregate.yml` — Supabase + (optional) indexing token.
- ☐ `digest.yml` — Supabase + Resend (`ALERTS_FROM`, `SITE_URL`).
- ☐ `badge-verify.yml` — Supabase + Resend + `LEADS_NOTIFY_EMAIL` + `SITE_URL` (HANDOVER: owner setup TODO — without it, badge-missing email won't send).

---

## 2. Static checks (fast, run on the branch before any manual QA)

- ☐ `npx tsc --noEmit` clean
- ☐ `npx eslint .` clean
- ☐ `npm test` (parser + JSON-LD + badge suites) green
- ☐ `npm run build` completes with no route/render errors
- ☐ Broken-link sweep across all pages in §3 (nav, footer, in-content, cross-links between role/state/city pages)
- ☐ Console-error sweep: open each page type with devtools open, zero uncaught JS errors / failed network calls / hydration warnings

---

## 3. Functional test matrix

Each area lists the flows to exercise and the **pass criterion**. Run each on
desktop Chrome + one mobile browser (iOS Safari or Android Chrome) unless noted.

### A. Candidate / job-seeker journey (P0 — this is the demand side)

| # | Flow | Pass criterion |
|---|------|----------------|
| A1 | Home `/` loads | Hero, featured carousel, search form, live counts render; no layout shift on mobile |
| A2 | Job board `/jobs` | Lists jobs in order **featured → direct/paid → scraped** (`listing_rank`); pagination works |
| A3 | Search + filter + sort | Role/state/city filters return correct results; sort options reorder within tier; empty search handled |
| A4 | Job detail `/jobs/[slug]` | Title, company (links to `/employers/[id]` for direct), description as real paragraphs, salary if present, Share button works |
| A5 | **Apply click** `/api/jobs/[id]/apply` | Scraped job → redirects to `source_url`; direct job with email → `mailto:`; direct w/o → `?apply=direct`. Click is **tracked** (this is the metric reported to employers — verify the count increments) |
| A6 | Share button | Native share on mobile; copy-link fallback on desktop |
| A7 | SEO landing pages: `/jobs/role/[role]`, `/jobs/state/[state]`, `/jobs/state/[state]/[role]`, `/jobs/city/[state]/[city]`, `/jobs/city/[state]/[city]/[role]` | Each renders unique content + count, cross-links to siblings, no thin/empty page indexed (0-inventory combos 404 or omitted) |
| A8 | Salary pages `/salary`, `/salary/[role]`, `/salary/[role]/[state]` | Pay bands render; `Occupation` JSON-LD present |
| A9 | Certifications `/certifications` | Content renders |
| A10 | Public employers `/employers`, `/employers/[id]` | Two-tier profile (simple vs enhanced) correct; `[id]` 404s when employer has no live jobs (no thin pages); static `/employers/*` routes win over `[id]` |
| A11 | 404 / bad slug | Friendly not-found, not a stack trace |

### B. Job alerts (P1 — the candidate retention loop)

| # | Flow | Pass criterion |
|---|------|----------------|
| B1 | Alert signup (compact form on job/role/city pages) | Submits; confirmation email sent |
| B2 | Alert signup (full form `/alerts`) — **multi state/city + multi role** | Fans out into one subscription per (location × role), capped at 200; confirm email sent |
| B3 | Double opt-in confirm `/api/alerts/confirm` | Link marks subscription confirmed; landing page shown |
| B4 | Unsubscribe `/api/alerts/unsubscribe` | One click removes; no login required; idempotent |
| B5 | Digest send (`digest.yml` / `send-digest.ts`) | Manually trigger: confirmed subscribers get only **new matching** jobs; city/state filter matches canonical spelling; last-sent updates; unconfirmed get nothing |

### C. Employer journey (P0 — this is who you're about to advertise to)

| # | Flow | Pass criterion |
|---|------|----------------|
| C1 | Register `/api/employer/register` | Account created; no duplicate-email crash |
| C2 | Login — **magic link** `/api/employer/magic-link` | Email arrives; link signs in; token single-use / expiring |
| C3 | Login — **password** `/api/employer/password` + `/login` | Sets & authenticates password; wrong password rejected |
| C4 | Session `/api/employer/session`, logout | Session persists across pages; logout clears it |
| C5 | **Post a job wizard** `/post-a-job` → `/api/post-job` | All steps validate (incl. step-1 street/postal capture); builds Stripe checkout |
| C6 | **Pay → publish** (full money path, see §4) | After successful payment, webhook (`kind`=new job) publishes the listing, sets 30-day `expires_at`, redirects to `/post-a-job/success`; job appears on board + Google-Indexing ping fires |
| C7 | 100%-off / free path | If discount = 100% or free-review fallback, job reaches `pending`/`published` **without** a Stripe charge; no dangling `unpaid` |
| C8 | Dashboard `/employers/dashboard` | Lists their jobs with status, apply-click counts, expiry dates |
| C9 | Profile `/employers/profile` | Company branding (website, logo_url), about/bio, badge embed snippet + preview, badge-URL submit |
| C10 | **Feature a job** `/employers/feature` | Upgrade path charges, sets featured, job jumps to featured tier + carousel |
| C11 | **Renew** `/api/jobs/[id]/renew` (logged-in OR `?token=`) | Paid renewal extends `expires_at`, clears `expiry_warned_at`; the one-click email-token path works without separate login |
| C12 | Expiry warning email (`warn-jobs.ts`) | 5 days before expiry, one email with working one-click renew button; not re-sent unless re-expiring |
| C13 | Auto-expire (`aggregate.yml` sweep) | 30-day direct listing flips to `expired`, drops off board, Indexing `URL_DELETED` ping; pre-rule evergreen (null expiry) listings untouched |
| C14 | "We're Hiring" badge `/api/badge/[id]` | SVG renders with live open-roles count; 404s unknown id; edge-cached |

### D. Advertiser journey (P0 for payment, P1 for the rest)

| # | Flow | Pass criterion |
|---|------|----------------|
| D1 | `/advertise` + guidelines + register/login (magic-link + password, `/api/ads/*`) | Mirror of employer auth; all work |
| D2 | Create ad + **creative upload** `/api/ads/creative` + link `/api/ads/link` | Image uploads to Supabase storage; link saved; renders in `SponsorSlot` |
| D3 | **Fixed-term ad checkout** (`kind`=ad) | Pays, webhook activates ad for the term, `/advertise/success` shown |
| D4 | **Monthly ad subscription** | `invoice.payment_succeeded` keeps it active; `invoice.payment_failed` handled; `customer.subscription.deleted` deactivates. **Test all three** — recurring billing is easy to get wrong |
| D5 | Ad renewal `/api/ads/[id]/renew` (`kind`=ad_renew) | Fixed-term renew extends; token path works |
| D6 | Click tracking `/api/ads/[id]/click` | Redirects to advertiser URL; click counted |
| D7 | Advertiser dashboard `/advertise/dashboard` + portal `/api/ads/portal` | Shows ad status/metrics; Stripe billing portal opens for subscription management |
| D8 | Advertiser expiry warning (`warn-ads.ts`, 7 days) | Email + working renew for fixed-term ads |
| D9 | Ad display on public pages | `SponsorSlot` shows active ads only; expired/inactive hidden; no broken image |

### E. Admin (P1)

| # | Flow | Pass criterion |
|---|------|----------------|
| E1 | Admin login `/admin/login` → `/admin` | Auth gate holds; wrong creds rejected; logout works |
| E2 | Post a job for a client `/api/admin/jobs` | Creates a published listing without Stripe; Indexing ping fires |
| E3 | Discount codes `/api/admin/discounts` | Create %-code with validity window, use cap, scope (jobs/ads/both); shows in list |
| E4 | Ads admin `/api/admin/ads/[id]` | Approve/edit/deactivate an ad |
| E5 | Employers admin `/api/admin/employers` | Enhanced-profile toggle flips two-tier public page; badge-deal status lights correct |
| E6 | Manual badge verify `/api/admin/verify-badge` | Fetches declared page, reports present/missing correctly |
| E7 | Subscriber list & counts | "See all subscribers" table renders chips, confirmed/pending, dates |
| E8 | Employer leads `/api/employer-leads` | Lead capture stored + `LEADS_NOTIFY_EMAIL` notified |

### F. Payments & money — deep dive (P0, **most important section**)

Cannot be exercised without live Stripe keys (HANDOVER). Do a **real, small,
refundable** transaction per path on production, then refund. Verify **both** the
user-facing result *and* the DB row *and* the Stripe dashboard event.

| # | Path | Verify |
|---|------|--------|
| F1 | New direct job | Charge succeeds → webhook `checkout.session.completed` (no `kind`) → job `published`, correct `expires_at`, receipt |
| F2 | Job renewal | `kind`=renew → `expires_at` extended, `expiry_warned_at` cleared |
| F3 | Featured upgrade | Charge → featured flag + carousel |
| F4 | Fixed-term ad | `kind`=ad → ad active for term |
| F5 | Ad renewal | `kind`=ad_renew → extended |
| F6 | Monthly ad subscription — happy path | first `invoice.payment_succeeded` activates; portal shows subscription |
| F7 | Monthly ad — **failed renewal** | `invoice.payment_failed` → ad state correct, no crash |
| F8 | Monthly ad — **cancelled** | `customer.subscription.deleted` → ad deactivates cleanly |
| F9 | **Discount code at checkout** | %-off applied to the right amount; scope enforced (job code can't be used on ad); use-count increments **only on payment** (`discountId` in metadata); expired/maxed code rejected |
| F10 | **Webhook idempotency / duplicates** | Stripe re-delivers events — replaying the same event must not double-publish or double-count a discount |
| F11 | **Abandoned checkout** | User closes Stripe without paying → job stays `unpaid`, never appears live, no ghost |
| F12 | **Signature failure** | Bad/missing `STRIPE_WEBHOOK_SECRET` → 400, event not processed (confirm the guard exists) |
| F13 | Refund a live job/ad | Confirm your refund actually happened for the test transactions above; note if refund should also unpublish (business decision) |

### G. Scheduled jobs / crons (P1)

Trigger each **manually** (Actions "Run workflow" or the npm script against prod)
and read the logs; don't wait for the schedule.

| # | Job | Verify |
|---|-----|--------|
| G1 | `aggregate.yml` (daily 07:00) | Scrapes all sources (adp, adzuna, greenhouse, lever, ukg, workday, jsonld, association); upserts jobs; expires stale/aged(9mo)/overdue(30d); Indexing pings batched, stops on quota; respects robots |
| G2 | Source health | Each scraper returns rows or fails soft (one broken feed must not abort the run); check `scripts/aggregate/SOURCES_TODO.md` for known gaps |
| G3 | `digest.yml` (07:30) | Alert digests + employer expiry + advertiser expiry all send |
| G4 | `badge-verify.yml` (Mon 08:00) | Checks declared badge pages; transient errors never flip to "missing"; missing → one email, re-arms on recovery |
| G5 | Salary re-parse | Daily aggregate re-runs `parseSalaryFromText`; coverage improves, no bad figures (bonuses/prices not misread) |

### H. SEO & structured data (P1 for launch quality, P2 for rankings)

| # | Check | Pass criterion |
|---|-------|----------------|
| H1 | `JobPosting` JSON-LD on `/jobs/[slug]` | Valid per Google Rich Results Test; `validThrough` always present (feed jobs use age-cap fallback); `<`/`>`/`&` escaped (no `</script>` breakout) |
| H2 | `BreadcrumbList` on city×role pages | Valid, escaped |
| H3 | `Occupation` on salary pages | Valid |
| H4 | `Organization` + `WebSite` in layout | logo → `/logo.png`, canonical brand |
| H5 | Meta titles/descriptions | Unique per page; salary median appended where designed; no dupes |
| H6 | Canonical tags + `metadataBase` | All www; no apex canonicals |
| H7 | Sitemap accuracy | Only live-inventory URLs; employer pages with live jobs; no 404s in sitemap |
| H8 | OpenGraph/Twitter cards | Job + home pages share with correct image/title |

### I. Cross-cutting quality (P1/P2)

| # | Area | Checks |
|---|------|--------|
| I1 | **Responsive** | Every page type at 360px / 768px / 1280px: no horizontal scroll, tap targets ≥44px, nav submenu works on touch (Tailwind hover-gate override in place — HANDOVER), carousel swipes |
| I2 | **Accessibility** | Keyboard-only nav through post-job + alert forms; visible focus; form labels; colour contrast (navy/brass); images have alt; Lighthouse a11y ≥90 |
| I3 | **Performance** | Lighthouse perf on home + `/jobs` + a job page; note that app is `force-dynamic` (uncached by design) — set a realistic bar, watch TTFB behind CDN |
| I4 | **Forms & validation** | Every form: required-field errors, bad email, oversized/invalid image upload, double-submit protection, server-side validation not just client |
| I5 | **Empty & error states** | Zero-result search, employer with no jobs, ad slot with no ads, DB/500 fallback page, Stripe/Resend outage degrades gracefully |
| I6 | **Security** | Auth cookies httpOnly/secure/sameSite; magic-link + renew tokens single-use & expiring; admin routes reject unauthenticated; no service-role key leaked to client; rate-limit magic-link + lead form (spam); discount codes can't be brute-forced; upload path can't store non-images/oversized |
| I7 | **Analytics/tracking** | `/api/track` + `PageViewTracker` fire; apply-click + ad-click counts are the numbers you'll report to employers — confirm they're accurate and not inflated by bots |
| I8 | **Legal/trust** | Privacy policy, terms, contact route, unsubscribe in every marketing email (CAN-SPAM/GDPR), cookie notice if required |
| I9 | **Cross-browser** | Chrome, Safari, Firefox, Edge; iOS + Android |

---

## 4. Test data & tooling

- **Stripe:** use live keys with **real small charges you refund**, since test-mode
  webhooks won't validate the live endpoint. Keep a log of each txn to refund.
  Alternatively stand up a Stripe **test-mode** webhook against a preview deploy to
  exercise F1–F12 logic safely, then do one real live smoke-charge per path.
- **Seed/staging data:** create a throwaway employer + advertiser account. Post a
  test job clearly marked `[TEST]`; delete/expire it before launch so it never
  shows to real users.
- **Email:** use a real inbox you control + a spam-check tool (mail-tester.com) to
  confirm SPF/DKIM/DMARC and that mail isn't binned.
- **Structured data:** Google Rich Results Test + Schema.org validator on 3 job
  URLs (one direct w/ salary+address, one feed job, one no-salary).
- **Automation (built — `tests/smoke/`):** a read-only Playwright smoke suite +
  config check cover the P0s that are safe to run against production repeatedly:
  - **Browser suite:** A1–A5, A8, A10, A11, B1/B2, C1–C5, D1, H1, H6/H7, plus
    **F12** (webhook rejects a forged signature), **I6** (admin gate), **I4**
    (invalid-email rejection). `npm run smoke`.
  - **Config check** (`npm run smoke:config`): **1.2/1.4** (Stripe webhook on the
    www host + subscribed to the 4 events), **1.6** (migrations applied), **A2**
    (`listing_rank` populated/in-range).
  The `smoke.yml` GitHub Action runs both every 6 hours, records the browser run
  in `smoke_runs` (shown in **Admin → Launch readiness**), and **emails
  `LEADS_NOTIFY_EMAIL` on any failure**. See `tests/smoke/README.md`.
- **Still manual — cannot self-test on production without real charges:** the
  payment P0s (C6, C7, C11, D3–D5, F1–F11), email delivery, and crons (G). The
  option for the payment P0s is a **Stripe test-mode end-to-end harness** (drives
  test-card checkouts + replays webhook events) — automatable, but it tests
  test-mode config, so still finish with one real live smoke-charge before launch.

---

## 5. Execution sequence

1. **§1 pre-flight** config audit (owner + me) — fix any config gaps first.
2. **§2 static checks** on the branch — must be green.
3. **§3 A/B** candidate + alerts on prod (no money) — the demand side works.
4. **§3 C/D/F** employer + advertiser + **payments** on prod — the money side works. *This is the gate.*
5. **§3 E/G** admin + crons — operational plumbing.
6. **§3 H/I** SEO + cross-cutting quality sweep.
7. **Log every ✗** as a ticket with pri; fix P0/P1; re-run affected cases.
8. **Go/No-Go** review (§6).
9. Remove all `[TEST]` data, purge CDN, final smoke of A1–A5 + one live payment.

---

## 6. Go / No-Go criteria

**GO only when:**
- ☐ Every **P0** case = ☑ (especially all of §F payments + C5/C6 pay-to-publish).
- ☐ Stripe webhook confirmed on the **www** endpoint with a real completed payment publishing a job.
- ☐ Email domain authenticated and a test alert + expiry mail landed in inbox (not spam).
- ☐ No uncaught JS/500 errors on any page type.
- ☐ All `[TEST]` data removed.
- ☐ P1 fails either fixed or owner-signed-off with a documented workaround.

**Owner sign-off:** _____________________  **Date:** __________

## 7. First 48 hours post-launch (monitoring)

- ☐ Watch Vercel runtime logs for 500s and the `Google Indexing: notified` lines.
- ☐ Watch Stripe dashboard: every checkout has a matching webhook `200` and a published listing (no paid-but-not-live gap).
- ☐ Watch Resend delivery/bounce/complaint rates.
- ☐ Confirm the next scheduled `aggregate` + `digest` cron runs succeed.
- ☐ GSC: coverage + Job-postings report; click **Validate Fix** on the `validThrough` warning (HANDOVER open item).
- ☐ Have a rollback plan: how to pull a bad listing, pause a scraper source, or revert a deploy.

---

*Living document — update as cases are run and as new features (candidate login #5,
contact form #4) land. Pair with `docs/HANDOVER.md`.*
