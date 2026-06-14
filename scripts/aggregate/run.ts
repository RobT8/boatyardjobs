import { upsertSourcedJob, expireMissingFromSource } from "../../src/lib/jobs";
import type { SourceAdapter } from "./types";
import { adzunaSource } from "./sources/adzuna";
import { createAdpSource } from "./sources/adp";
import { createGreenhouseSource } from "./sources/greenhouse";
import { createWorkdaySource } from "./sources/workday";

/**
 * Source registry.
 *
 * Direct-employer sources (Greenhouse/Workday) use public, key-free endpoints
 * and run on every invocation. Adzuna is enabled only when its keys are present.
 *
 * Add more employers:
 *  - Greenhouse board: createGreenhouseSource({ id, name, company, token }).
 *  - Workday careers:  createWorkdaySource({ id, name, company, host, tenant, site }).
 *  - ADP Workforce Now: createAdpSource({ id, name, company, cid }).
 *  - Pages with schema.org JobPosting JSON-LD: createJsonLdSource (./sources/jsonld).
 */
const ADAPTERS: SourceAdapter[] = [
  createGreenhouseSource({
    id: "gh-arcboatcompany",
    name: "Arc Boat Company",
    company: "Arc Boat Company",
    token: "arcboatcompany",
  }),
  createGreenhouseSource({
    id: "gh-navierboat",
    name: "Navier",
    company: "Navier",
    token: "navierboat",
  }),
  createWorkdaySource({
    id: "wd-brunswick",
    name: "Brunswick (Mercury Marine, Boston Whaler, Sea Ray)",
    company: "Brunswick",
    host: "brunswick.wd1.myworkdayjobs.com",
    tenant: "brunswick",
    site: "search",
  }),
  // Suntex Marinas runs ADP Workforce Now (cid from suntex.com/careers).
  // NOTE: requires `workforcenow.adp.com` in the aggregation network allowlist;
  // until then this adapter fails fast and is skipped (other sources untouched).
  createAdpSource({
    id: "adp-suntex",
    name: "Suntex Marinas",
    company: "Suntex Marinas",
    cid: "08f6f0d8-fe33-401f-a518-03fc32c3ad35",
  }),
];

if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
  ADAPTERS.push(adzunaSource());
}

/**
 * Aggregation entry point — run on a schedule (cron / GitHub Action):
 *   npm run aggregate
 *
 * Per source we: upsert every fetched listing (new → insert, changed → update,
 * reappeared → re-publish), then expire any previously-published listing that
 * has vanished upstream. Expiry runs ONLY after a successful fetch, so a
 * transient outage can't wipe the board. Each source is isolated: one failing
 * adapter never touches another's listings.
 */
async function main() {
  let created = 0;
  let updated = 0;
  let expired = 0;

  for (const adapter of ADAPTERS) {
    console.log(`[${adapter.id}] fetching…`);
    let jobs;
    try {
      jobs = await adapter.fetchJobs();
    } catch (err) {
      console.error(`[${adapter.id}] FAILED, skipping (listings left untouched):`, err);
      continue;
    }

    const seenUrls: string[] = [];
    let srcCreated = 0;
    let srcUpdated = 0;
    for (const job of jobs) {
      const result = await upsertSourcedJob({ ...job, source: adapter.id });
      if (job.source_url) seenUrls.push(job.source_url);
      if (result === "created") srcCreated++;
      else if (result === "updated") srcUpdated++;
    }

    const srcExpired = await expireMissingFromSource(adapter.id, seenUrls);
    created += srcCreated;
    updated += srcUpdated;
    expired += srcExpired;
    console.log(
      `[${adapter.id}] done — ${jobs.length} fetched ` +
        `(${srcCreated} new, ${srcUpdated} updated, ${srcExpired} expired)`
    );
  }

  console.log(
    `Aggregation complete: ${created} new, ${updated} updated, ${expired} expired.`
  );
}

main();
