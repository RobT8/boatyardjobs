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

### Suntex Marinas — LIVE ✅
- **ATS: ADP Workforce Now**, NOT Paylocity. Confirmed by reading
  https://suntex.com/careers/ — the "VIEW CAREER OPPORTUNITIES" button links to
  `workforcenow.adp.com/.../recruitment.html?cid=08f6f0d8-fe33-401f-a518-03fc32c3ad35&ccId=19000101_000001&type=MP`.
- Adapter: `sources/adp.ts`, registered in `run.ts` as `adp-suntex`.
- **Verified live (2026-06-14):** `workforcenow.adp.com` reachable; feed reports
  137 requisitions; adapter returns **38 trade listings** (dockhands, yard hands,
  technicians, mechanics) after the pagination fix. robots.txt allows it.
- **Notes on the live shape (handled):**
  - The list endpoint caps a page at ~20 regardless of `$top` and returns *fewer*
    than the cap on the first page (19) — pagination advances by the actual batch
    size and stops on the reported `meta.totalNumber`.
  - Structured address is frequently blank; location is recovered from
    `nameCode.shortName` ("[Marina, ]City, ST, US"). One requisition (Dockhand /
    "Shalimar Harbor") carries no state anywhere and is intentionally dropped.
  - Descriptions live only on the per-requisition detail call (list items omit
    them); the adapter already fetches detail when the list description is empty.

### Safe Harbor Marinas — BLOCKED by robots.txt ⛔ (registered, skipped)
- **ATS: UKG Ready** (Kronos Workforce Ready / SaaShr). safeharbor.com/careers
  redirects into the portal at
  `https://secure4.saashr.com/ta/6166382.careers?CareersSearch=`
  (listing) with per-job detail at `?ShowJob={requisitionId}`.
- Adapter: `sources/ukg.ts`, registered in `run.ts` as `ukg-safeharbor`.
- **Host is reachable** (HTTP 200, 2026-06-14) but `secure4.saashr.com/robots.txt`
  disallows every crawler except Google:
  ```
  User-agent: GoogleOther
  Allow: /ta/fs
  User-agent: *
  Disallow: /
  ```
  Under our policy (honor robots.txt; only the licensed Adzuna API is exempt) the
  adapter correctly fails fast with `RobotsDisallowedError` and run.ts skips it,
  leaving other sources untouched. It is left registered on purpose.
- **Next step (owner):** contact Safe Harbor for written permission to ingest
  their public listings. Once authorized, treat like Adzuna — skip the robots
  check for this host only — and re-verify the live shape (do detail pages carry
  JSON-LD; is the listing paginated past the first page?).

## Verifications (this environment, 2026-06-14)
- `api.lever.co` reachable — HTTP 200 (`/v0/postings/leverdemo`).
- `workforcenow.adp.com` — reachable; live fetch returns 38 trade jobs for Suntex.
- `secure4.saashr.com` — reachable (HTTP 200) but robots.txt blocks all non-Google
  crawlers; ukg-safeharbor is skipped pending permission.
- `safeharbor.com` / `shmarinas.com` — TLS handshake fails from here; can't be
  fetched (ATS identified via the user-supplied portal URL instead).
