# Smoke suite

Fast, **read-only** Playwright checks of the core live flows. Safe to run against
production — they create no accounts, post no jobs, take no payments, and send no
emails. They answer one question: *are the load-bearing flows alive?*

## What's covered

| File | Checklist IDs | Flow |
|------|---------------|------|
| `public.spec.ts` | A1–A5, A8, H1 | Home, job board, search, a job page + tracked Apply link, salary page, valid JobPosting JSON-LD |
| `accounts.spec.ts` | B1/B2, C1–C5, D1, A10 | Alerts form, employer sign-in, post-a-job wizard, advertise + employers pages |
| `infra.spec.ts` | H6/H7, A11 | robots.txt, sitemap.xml, 404 handling, apex→www redirect |

Payments (F), email delivery, and crons (G) are **not** here — they need live
keys / real charges and stay manual per `docs/LAUNCH-TEST-PLAN.md`.

## Run it

```bash
# against production (default)
npm run smoke

# against a Vercel preview or local build
SMOKE_BASE_URL=https://<preview>.vercel.app npm run smoke

# record the run to the DB + email on failure (what the GitHub Action runs)
SMOKE_BASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  RESEND_API_KEY=... ALERTS_FROM_EMAIL=... LEADS_NOTIFY_EMAIL=... \
  npm run smoke:record
```

First run locally needs the browser: `npx playwright install chromium`.

## In CI

`.github/workflows/smoke.yml` runs every 6 hours (and on demand), records each
run in `smoke_runs`, and emails `LEADS_NOTIFY_EMAIL` on failure. Results show in
**Admin → Launch readiness**.

## Notes

- Selectors target stable text/hrefs, but if the markup changes and a check goes
  falsely red, adjust the spec — a red smoke run should always mean a real break.
- Tests `test.skip()` themselves when there's no live inventory to open, so an
  empty board doesn't cause a false failure.
