# Job-source adapter backlog

Tracks employer/aggregator sources we want to ingest, the ATS each one runs on,
and the adapter status. Add an employer by wiring a factory into `run.ts` (see
the "Add more employers" note there).

## Adapter factories available

| ATS / shape            | Factory                | Endpoint type                    | Key? |
| ---------------------- | ---------------------- | -------------------------------- | ---- |
| Greenhouse             | `createGreenhouseSource` | public boards-api JSON          | no   |
| Workday (CXS)          | `createWorkdaySource`    | public CXS list + detail JSON   | no   |
| ADP Workforce Now      | `createAdpSource`        | public career-center JSON       | no   |
| UKG Ready (SaaShr)     | `createUkgSource`        | careers portal + JSON-LD detail | no   |
| schema.org JSON-LD     | `createJsonLdSource`     | scrape ld+json off a page       | no   |
| Adzuna (aggregator)    | `adzunaSource`           | official API (env keys)         | yes  |
| Lever                  | _not built yet_          | public postings API (`api.lever.co/v0/postings/{org}`) | no |

## Sources

### Suntex Marinas — DONE (pending egress)
- **ATS: ADP Workforce Now**, NOT Paylocity. Confirmed by reading
  https://suntex.com/careers/ — the "VIEW CAREER OPPORTUNITIES" button links to
  `workforcenow.adp.com/.../recruitment.html?cid=08f6f0d8-fe33-401f-a518-03fc32c3ad35&ccId=19000101_000001&type=MP`.
- Adapter: `sources/adp.ts`, registered in `run.ts` as `adp-suntex`.
- **Blocker:** `workforcenow.adp.com` is not in the aggregation network
  allowlist (verified unreachable from the run environment). Add that host, then
  confirm the JSON field shape on the first live run (the parser is tolerant of
  the known tenant variants but hasn't been run against the live payload).

### Safe Harbor Marinas — DONE (pending egress)
- **ATS: UKG Ready** (Kronos Workforce Ready / SaaShr). safeharbor.com/careers
  redirects into the portal at
  `https://secure4.saashr.com/ta/6166382.careers?CareersSearch=`
  (listing) with per-job detail at `?ShowJob={requisitionId}`.
- Adapter: `sources/ukg.ts`, registered in `run.ts` as `ukg-safeharbor`.
- **Blocker:** `secure4.saashr.com` is not in the aggregation network allowlist
  (verified unreachable from the run environment). Add that host, then confirm on
  the first live run that detail pages carry JSON-LD and the listing isn't
  paginated past the first page.

## Verifications (this environment)
- `api.lever.co` reachable — HTTP 200 (`/v0/postings/leverdemo`).
- `workforcenow.adp.com` — NOT in egress allowlist (needs adding for Suntex).
- `secure4.saashr.com` — NOT in egress allowlist (needs adding for Safe Harbor).
- `safeharbor.com` / `shmarinas.com` — NOT in egress allowlist / TLS handshake
  fails; can't be fetched from here (ATS identified via the user-supplied portal
  URL instead).

## Egress allowlist — hosts to add before these sources fetch
- `workforcenow.adp.com` (Suntex / ADP)
- `secure4.saashr.com` (Safe Harbor / UKG Ready)
