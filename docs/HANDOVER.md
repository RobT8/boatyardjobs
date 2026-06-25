# Session handover / work log

> **Purpose:** the running record of what's been built, the decisions behind it,
> and what's left — so a fresh session can get fully oriented in a couple of
> minutes. `AGENTS.md` points here, and `AGENTS.md`/`CLAUDE.md` are auto-loaded
> at the start of every session.
>
> **Keep this current:** at the end of a working session, add a dated entry to
> the **Session log** (newest first) and update **Open work** / **Decisions** if
> they changed. Keep it short — what changed and why, not a diff.

---

## How to get oriented fast

- **Stack:** Next.js 16 (App Router, React 19), Tailwind v4, Supabase (Postgres
  + storage), Stripe, Resend (email). See `AGENTS.md` — this is a modified
  Next.js; read `node_modules/next/dist/docs/` before relying on framework
  behaviour from memory.
- **Where the schema lives:** there is **no SQL in the repo**. The database is
  the remote Supabase project `zpesevmnmaifnooqiyrr` (name: `boatyardjobs`).
  Inspect/alter it with the Supabase MCP tools (`list_tables`, `apply_migration`,
  `execute_sql`). All app DB access uses the service-role key (`src/lib/db.ts`),
  so RLS doesn't block server code.
- **Deploy:** pushes to `main` auto-deploy via **Vercel**. The custom domain
  `boatyardjobs.com` sits behind a CDN (Cloudflare-ish) — when verifying a
  change, test the raw `*.vercel.app` deployment URL to bypass the edge cache,
  or purge the CDN.
- **Run locally:** `npm install` then `npm run dev`. Most pages need Supabase env
  vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); without them DB-backed
  pages 500. Marketing/login pages render with dummy values.
- **Checks before pushing:** `npx tsc --noEmit`, `npx eslint <files>`,
  `npm test` (parser tests). There's no full e2e harness; Stripe flows can't be
  exercised locally without live keys.
- **Scheduled jobs (GitHub Actions):**
  - `aggregate.yml` — daily 07:00 UTC: scrape feeds + expire stale/aged/overdue
    listings (`scripts/aggregate/run.ts`).
  - `digest.yml` — daily 07:30 UTC: alert digests, **employer** expiry warnings,
    **advertiser** expiry warnings (`scripts/alerts/send-digest.ts`,
    `scripts/expiry/warn-jobs.ts`, `scripts/expiry/warn-ads.ts`).

## Key product decisions (confirmed with owner)

- **Job listings run 30 days** (`DIRECT_JOB_DAYS` in `src/lib/jobs.ts`). Feed
  (scraped) jobs are exempt — they use the upstream-vanish + 9-month age cap.
- **Renewals are paid** at the same price as a fresh post / the ad's original
  term (not discounted, not free).
- **Discount codes are percentage-based.** Admin-set, with optional validity
  window + use cap, scoped to jobs / ads / both. Applied at checkout. (Ads:
  fixed-term placements only, not monthly subscriptions.)
- **Candidate login (planned) = magic-link email** (matches the existing
  employer/advertiser passwordless pattern).
- **Contact form (planned) audience = all registered users, including candidates**
  (so it depends on candidate login landing first).
- Existing already-live direct listings were left **evergreen** (null
  `expires_at`) so nothing posted before the 30-day rule got pulled unexpectedly.

## Architecture notes / gotchas

- **Tailwind v4 gates `hover:` behind `@media (hover: hover)`.** This silently
  drops hover styles on touch-capable devices (even with a mouse). We override it
  in `src/app/globals.css` with `@custom-variant hover (&:hover);` — keep that.
- **Listing lifecycle:** `jobs.status` ∈ `unpaid` → `published` → `expired`
  (also `pending` for the free/reviewed fallback when Stripe is off). Renewal
  clears `expiry_warned_at` so a re-expiring listing is warned again.
- **Stripe webhook** (`src/app/api/stripe/webhook/route.ts`) branches on
  `session.metadata.kind`: `ad`, `ad_renew`, `renew` (job renew), else new job.
  A `discountId` in metadata increments the code's use count on payment.
- **Renewal auth:** `/api/jobs/[id]/renew` and `/api/ads/[id]/renew` accept
  either a logged-in session or `?token=<login_token>` (so the "about to expire"
  email button works in one click without a separate sign-in).

## Open work (requested but not yet built)

- **#5 Candidate login** — magic-link sign-in for candidates; at this stage only
  show their alert info (subscriptions). New `candidates`/session plumbing,
  mirror `employer-auth`/`advertiser-auth`. *Owner deferred; do this before #4.*
- **#4 Contact form** for registered users (incl. candidates) — messages emailed
  to an admin address. Depends on #5 for the candidate audience.
- **Verify on live:** real-purchase test of Stripe renewal + discount-code
  pricing on the deployed site (couldn't be done from the build env — needs live
  Stripe keys).

## Session log (newest first)

### 2026-06-25 — Google for Jobs: validThrough + JSON-LD hardening
Audited the `JobPosting` structured data (`src/app/jobs/[slug]/page.tsx`) against
Google's spec — all required fields present, would pass Rich Results. Two fixes:
- **`validThrough` now always emitted.** Previously only direct listings (which
  carry `expires_at`) were dated; all 605 live jobs are scraped feed rows with
  null expiry, so none had it — a Google quality gap. New `jobValidThroughIso()`
  in `src/lib/jobs.ts` falls back to the age-cap bound (`posted_at +
  FEED_MAX_AGE_MONTHS`) for feed jobs.
- **JSON-LD breakout hardened.** `JSON.stringify` left `<` intact, so a scraped
  description containing `</script>` could break out of the tag (XSS/markup
  risk). New `safeJsonLd()` escapes `<`/`>`/`&`. (Salary pages emit `Occupation`
  schema from static taxonomy + numeric inputs, so they weren't at risk.)
- Couldn't run Google's hosted Rich Results Test — the network policy blocks the
  live domain from the build env (same constraint as the live-purchase check).

### 2026-06-25 — Admin: full subscriber list
The admin dashboard already showed subscriber *counts* by state/role; added a
collapsible **"See all subscribers"** table under that section showing each
subscriber (email, the role/location combos they signed up for as chips,
confirmed/pending, joined + last-sent dates). New `listAlertSubscribers()` in
`src/lib/alerts.ts` folds the per-(location × role) rows to one entry per email.

### 2026-06-25 — Multi state/city job alerts
Alerts can now target **multiple states and/or cities** (previously one state).
Each ticked location is an independent OR-subscription (a state and a city in
another state can be watched at once), crossed with each ticked role — so the
signup fans out into one alert row per (location × role), capped at 200.

- Migration `add_alerts_city`: new nullable `alerts.city` column (paired with
  `state` so a city name is disambiguated across states). Not in repo.
- `src/lib/alerts.ts`: `createAlert`/`findAlert` take a `city`; `newJobsForAlert`
  filters on it (`eq`, matching the canonical spelling like the search filter).
- `src/app/api/alerts/route.ts`: parses repeated `state` codes + `city` values
  (encoded `ST|City`), builds the location list, creates the cross-product.
- Full signup form now uses the `MultiSelect` dropdowns (roles/states/cities).
  Extracted `MultiSelect` out of `SearchForm` into `src/components/MultiSelect.tsx`
  (shared); new `src/components/AlertFullForm.tsx` (client). Compact variant on
  job/role/city pages is unchanged. `/alerts` + home page now feed the pickers
  with live `countByState`/`countByCity` inventory.

### 2026-06-25 — Job-board feature batch + nav fixes
Owner gave a 9-item list ("start with the easiest"); built 7, deferred #4/#5.

- Nav: fixed sign-out submit; clearer submenu + top-level hover highlight; root
  cause of "hover not working" was the Tailwind `@media (hover: hover)` gate
  (see Architecture notes). Commits `c407217`, `25ff282`, `d6d1da1`,
  `605f6d7`, `70ba2a0`.
- **#1** Share button on job pages (`ShareJob.tsx`) — `d9c0d21`.
- **#2** Multi-role tick-box alerts; one confirm click covers all — `8903a59`.
- **#7** 30-day job time limit + daily overdue sweep — `fcd3b7f`.
- **#8** Employer expiry email (5 days out) + one-click paid renew — `a103153`.
  Migration: `jobs.expiry_warned_at`.
- **#9** Advertiser expiry email (7 days out) + renew for fixed-term ads —
  `591b4f5`. Migration: `ads.expiry_warned_at`.
- **#3** Admin "post a job for a client" form/endpoint — `b9cc021`.
- **#6** Percentage discount codes (admin panel + checkout integration) —
  `b122275`. Migration: new `discount_codes` table.

Migrations applied this session (Supabase, not in repo): `add_jobs_expiry_warned_at`,
`add_ads_expiry_warned_at`, `add_discount_codes`.
