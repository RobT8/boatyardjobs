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

### SEO / Google-ranking workstream (started 2026-06-29 — resume here)

Owner is trying to rank in the **US** for marine-trades queries (e.g. "marina
jobs Florida"). Diagnosis so far: generic geo terms are owned by the
aggregators (Indeed/ZipRecruiter/Glassdoor/Jooble) — not winnable head-on. The
niche play is **long-tail role+location pages + Google-for-Jobs widget +
employer backlinks**. CareerBoat.com is the closest comparator (ranks for its
brand, not generic terms either). Structured-data groundwork is now done; next:

- **Owner action (GSC):** click **Validate Fix** on the `validThrough` warning
  in the Job postings report (code already correct since 2026-06-25). Then watch
  the `streetAddress`/`postalCode` warning counts fall as direct listings gain
  addresses.
- **Long-tail landing pages (biggest ranking lever, NOT yet built):**
  programmatic role×city pages targeting low-competition intent (e.g. "marine
  diesel technician jobs Fort Lauderdale"). Role×state pages already exist under
  `/jobs/state/[state]/[role]` and `/salary/...`; extend to city granularity and
  strengthen internal linking. *Owner agreed this is the next focus.*
- **Employer backlink campaign:** outreach email drafted (offer 3 months free
  posting for a careers-page link). Better than a plain link — build an
  **embeddable "We're Hiring on BoatyardJobs" badge** (HTML snippet + SVG/image)
  employers paste on their site for a contextual backlink. Not built yet. The
  new `employers.website` capture supports this.
- **Salary coverage:** `baseSalary` missing on ~16 listings (no pay data).
  Don't fabricate — improve scraper salary parsing + nudge employers to add pay;
  salary lifts both eligibility and click-through in the widget.
- **Employer logo upload:** currently a pasted `logo_url`. Future: real upload to
  Supabase storage (mirror the `ad_creatives` image_path/image_url pattern).
- **Backfill:** existing direct listings have no `street_address`/`postal_code`
  (only ~1 employer / few direct jobs today) — backfill once addresses exist.
- **Perf (optional, not SEO):** the whole app uses `force-dynamic`. Fully
  crawlable but uncached; a site-wide ISR/caching pass is a separate perf
  discussion, deliberately untouched.

## Session log (newest first)

### 2026-07-07 — Canonical host is www: fixed bare-domain defaults
Discovered `boatyardjobs.com` **308-redirects to `www.boatyardjobs.com`** (www
is canonical), but every code default for `SITE_URL` was the bare apex — so the
sitemap, `metadataBase`, robots sitemap pointer, email links and **all Google
Indexing API pings since 2026-07-02** were emitting URLs that redirect. Google
treats redirected sitemap/ping URLs as second-class, blunting the indexing
fast-lane. Flipped all four code defaults (`sitemap.ts`, `robots.ts`,
`layout.tsx`, `email.ts` `siteUrl()`) and the docs to www.
- **Owner confirmed same day:** `SITE_URL` in Vercel and the GitHub Actions
  secret are now the www value (env overrides the code default, so both
  mattered).
- **Still open (owner):** confirm the Stripe dashboard webhook endpoint is the
  `www.` URL — Stripe doesn't follow the apex's 308 redirect, so a bare-domain
  endpoint would silently break paid-job publishing.
- GSC note: sitemap resubmitted 2026-07-07 showed "Couldn't fetch" briefly,
  then went Active on its own — that status is often provisional; Googlebot is
  not blocked by the CDN.

### 2026-07-07 — Long-tail role×city landing pages (biggest ranking lever)
Built the programmatic **role×city** pages the SEO workstream flagged as the top
priority — ~380 new pages targeting low-competition intent like "marine
technician jobs Jacksonville" / "marine electrician jobs San Diego".
- **New route** `src/app/jobs/city/[state]/[city]/[role]/page.tsx` — mirrors the
  existing city and state×role pages: featured-first job list, unique role
  description + count for on-page substance (not thin), alert-signup CTA.
- **New helper `countByCityAndCategory()`** in `src/lib/jobs.ts` — folds
  free-form city spellings on the slug (same canonical name as `countByCity`, so
  a city reads identically across its city and role×city pages) and counts per
  (state, city, category). Powers the page resolver, cross-links and sitemap.
- **Internal linking (the crawl path):** city page "jobs by trade" chips now
  point at role×city (was state×role); state×role pages gained a "by city"
  section; role×city pages cross-link sibling roles in the same city and the
  same role in nearby cities. So Google can traverse board → state → role →
  city→role.
- **Sitemap:** emits one URL per (city, role) with live inventory only
  (`n > 0`, known role slug) — keeps thin/empty combos out of the index.
- Verified: `tsc`, `eslint`, `npm test` all clean; confirmed 380 real combos in
  the DB. Live render not driven from here (no local Supabase env; live domain
  403s the build env) — check on the Vercel deploy.
- **Next SEO lever:** the "We're Hiring" embeddable backlink badge (authority is
  the remaining ceiling), and salary-coverage backfill.

### 2026-07-02 — Google Indexing API fully live (cron + Vercel)
Finished wiring the keyless Indexing API end to end and verified both paths in
production.
- **Cron (GitHub Actions):** verified — a run notified Google of 109 live + 37
  removed jobs; Googlebot is actively crawling from it.
- **Vercel real-time path:** now working. Two fixes were needed:
  1. Read the OIDC token via `@vercel/functions` `getVercelOidcToken()` — in
     production Vercel does **not** expose `process.env.VERCEL_OIDC_TOKEN`
     (it's request-scoped). Added the `@vercel/functions` dep.
  2. Recreated the `vercel` WIF provider keyed off the token's `sub` claim
     (`assertion.sub.startsWith('owner:<team>:project:<project>:')`) with a
     `principal://…/subject/…:environment:production` binding — Vercel tokens
     don't carry top-level `owner`/`project` claims, and the first attempt had
     run under the wrong Google account (silent PERMISSION_DENIED).
  Verified: `Google Indexing: notified live <url>` in the Vercel runtime log.
- GCP note: the project `project-f54f50ba-36cd-44b4-9b5` (BoatyardJobs, number
  470200732686) is owned by the **t80.dev@gmail.com** Google account, not the
  main `robtait88` account — use t80.dev for any gcloud work. Pool `github` holds
  two providers: `github-actions` (cron) and `vercel` (runtime); SA is
  `boatyardjobs-indexing@…`, an Owner of the Search Console property.
- Setup fully documented in `docs/google-indexing-setup.md`.

### 2026-06-29 — Richer JobPosting structured data (Google for Jobs)
- **Context:** owner is chasing US ranking for marine-trades queries. GSC "Job
  postings" report showed all items valid but with "improve appearance"
  warnings: missing `validThrough` (14 — stale crawls from before the 2026-06-25
  always-emit fix; just needs GSC "Validate Fix"), `baseSalary` (16 — genuinely
  no salary on those jobs; left as-is, we don't fabricate), and
  `streetAddress`/`postalCode` (22 each — data gap).
- **JobPosting description** now renders as real HTML `<p>` paragraphs
  (`descriptionHtml` in `src/lib/jobs.ts`) instead of one `<p>` blob, so the
  widget reads properly. Escapes `&<>`.
- **Extracted `jobPostingJsonLd` into `src/lib/jobs.ts`** (was inlined in the job
  page) as a pure, unit-tested builder. New tests in
  `scripts/jobs-jsonld.test.ts` (wired into `npm test`).
- **New optional structured-data fields, all additive/nullable** (migration
  `add_jobs_address_and_employer_branding`):
  - `jobs.street_address`, `jobs.postal_code` → `jobLocation.address`
    `streetAddress`/`postalCode`. Captured in the post-a-job wizard (step 1).
  - `employers.website`, `employers.logo_url` → `hiringOrganization.sameAs` /
    `logo`. Captured in the employer **profile** page ("Company branding" card →
    `POST /api/employer/profile`, `updateEmployerProfile`). The job page fetches
    the owning employer to enrich the markup.
- **Scope note:** only **direct** listings get address/branding — scraped feed
  jobs have no employer/street/zip, so they stay city/state (still valid markup,
  no map pin). Address warnings shrink as direct listings grow. The employer
  website capture also feeds the planned employer-backlink outreach.
- **Not done (deliberate):** did NOT switch the job page off `force-dynamic` to
  ISR — it's an app-wide convention and `force-dynamic` is still fully crawlable
  (SSR'd), so that's a perf discussion, not an SEO fix. Logo is a pasted URL, not
  an upload (storage upload left as future work).

### 2026-06-25 — Listing order + Google Indexing API
- **Fixed listing order: featured → direct/paid → scraped.** New generated
  column `jobs.listing_rank` (0 featured · 1 direct · 2 feed; migration
  `add_jobs_listing_rank`, plus a partial index on `(listing_rank, posted_at)`).
  `listJobs` orders by it first, then the within-tier sort, so every board page
  reads in that order regardless of the chosen sort. (Listing pages already pull
  featured into a separate top section via `getFeaturedJobs` + `excludeFeatured`,
  so in practice the main list now shows direct-paid before scraped.)
- **Google Indexing API** (`src/lib/google-indexing.ts`) — pings Google the
  moment a JobPosting page goes live / changes / comes down, instead of waiting
  for an organic crawl. JWT (RS256) signed with Node `crypto`, no new deps;
  access-token cached per run. **Auth is keyless** — our Google org's
  Secure-by-Default policy blocks service-account keys, so the GitHub cron uses
  **Workload Identity Federation**: the code reads a pre-minted
  `GOOGLE_INDEXING_ACCESS_TOKEN` (the JSON-key/JWT flow remains as a fallback).
  Fully no-op unless configured; the service account must be an **Owner** of the
  Search Console property. Setup steps: `docs/google-indexing-setup.md`. Wired in:
  - aggregation cron (`scripts/aggregate/run.ts`): created/updated feed slugs →
    `URL_UPDATED`, expired slugs → `URL_DELETED`, batched at end, best-effort,
    stops early on quota (default ~200/day). Required plumbing slugs out of
    `upsertSourcedJob` (now returns `{result, slug}`) and the three `expire*`
    fns (now return `string[]` of slugs); `publishPaidJob`/`renewDirectJob` now
    return the slug.
  - Stripe webhook (new direct job, job renew), admin "post for a client",
    post-job 100%-off path → `URL_UPDATED`. These run on Vercel and are keyless
    too: the code exchanges the runtime's `VERCEL_OIDC_TOKEN` via Google STS and
    impersonates the SA (needs Vercel OIDC on + a `vercel` WIF provider + the
    `GCP_*` env vars; see the setup doc step 5). No-op until configured.
  - `aggregate.yml`: `permissions: id-token: write` + a `google-github-actions/auth@v2`
    step (token_format=access_token, indexing scope), guarded on repo vars
    `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_INDEXING_SERVICE_ACCOUNT`; passes
    `GOOGLE_INDEXING_ACCESS_TOKEN` + `SITE_URL` to the run.
  - **TODO to go live (keyless):** run the GCP setup in
    `docs/google-indexing-setup.md` (enable API, create SA — no key, create WIF
    pool/provider for the repo), add the SA as a Search Console **Owner**, set the
    two repo *variables* + `SITE_URL` secret. Until then it's dark.

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
