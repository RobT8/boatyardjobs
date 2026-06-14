# Aggregation sources — working notes / handoff

Status of the effort to add more job sources. Pick up here in a new session.

## Done
- **Adzuna** adapter widened: search terms now cover all 8 role categories +
  high-volume generics; pagination raised to 3 pages/term with an early stop.
  Needs `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` set wherever `npm run aggregate` runs.
- **Lever** adapter added (`sources/lever.ts`, `createLeverSource`). Clean public
  JSON API (`api.lever.co/v0/postings/{site}?mode=json`), mirrors Greenhouse.
  Not yet registered with any employer (no confirmed Lever marine employer found).

## Tier-1 employers — ATS findings (need a network-enabled session to finish)
Probing/verification is blocked in the standard sandbox (network policy returns
`x-deny-reason: host_not_allowed`). A session whose environment allowlist
includes the hosts below is required to confirm tokens and verify each pulls jobs.

| Employer | ATS (from research) | Clean JSON API? | Plan |
|---|---|---|---|
| Freedom Boat Club | Brunswick Workday | ✅ already covered by `wd-brunswick` | none — done |
| MarineMax | ADP WorkForceNow (`workforcenow.adp.com`) | ❌ messy/session-gated | rely on Adzuna, or build ADP adapter |
| Suntex Marinas | Paylocity (`recruiting.paylocity.com`) | ⚠️ has a public job feed | build a Paylocity adapter (verify feed endpoint + company GUID) |
| Safe Harbor Marinas | unconfirmed (owned by Sun Communities) | ? | identify ATS first |

All three already syndicate to **Adzuna**, so they reach the site indirectly
once Adzuna keys are set; bespoke adapters add first-hand, higher-SEO listings.

## Next steps (in a network-enabled session)
1. Confirm allowlist includes: `boards-api.greenhouse.io`, `api.lever.co`,
   `*.myworkdayjobs.com`, `api.adzuna.com`, `recruiting.paylocity.com`,
   `workforcenow.adp.com`, and the employer careers hosts.
2. Probe each careers/apply URL to confirm ATS + token/company id.
3. Build a **Paylocity** adapter (Suntex) and, if tractable, an **ADP WorkForceNow**
   adapter (MarineMax). Register Safe Harbor once its ATS is known.
4. Hunt for marine employers on Greenhouse/Lever/Ashby to register clean
   first-hand feeds (see existing Arc/Navier Greenhouse sources for the pattern).
5. Run `npm run aggregate` and confirm new/updated counts per source.

## Source-adapter patterns (already in repo)
- `greenhouse.ts` — `createGreenhouseSource({ id, name, company, token })`
- `lever.ts` — `createLeverSource({ id, name, company, site })`
- `workday.ts` — `createWorkdaySource({ id, name, company, host, tenant, site })`
- `jsonld.ts` — `createJsonLdSource({ id, name, url, pages? })` for schema.org JobPosting pages
- `example-association.ts` — template to copy for bespoke HTML scrapers
