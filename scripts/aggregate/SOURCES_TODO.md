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

### Safe Harbor Marinas — BLOCKED (ATS unconfirmed)
- Careers page https://shmarinas.com/careers/ is unreachable from this
  environment (egress proxy fails the TLS handshake; render proxies 403/503), so
  the embedded ATS could not be confirmed.
- Ruled out: Lever and Greenhouse (404 for `safeharbor*` / `shmarinas` tokens).
- Workday / iCIMS / UKG probes were inconclusive (those platforms return
  403/406/500 to bare requests regardless of whether a tenant exists).
- **Next step:** obtain the apply-portal URL (a `recruiting.*` / `*.myworkdayjobs.com`
  / `*.icims.com` / `workforcenow.adp.com?cid=...` link from the live careers
  page) and register it with the matching factory.

## Verifications (this environment)
- `api.lever.co` reachable — HTTP 200 (`/v0/postings/leverdemo`).
- `workforcenow.adp.com` — NOT in egress allowlist (needs adding).
- `shmarinas.com` — egress TLS handshake fails (`TLSV1_ALERT_PROTOCOL_VERSION`).
