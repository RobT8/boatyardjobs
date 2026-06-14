import { upsertSourcedJob, expireMissingFromSource } from "../../src/lib/jobs";
import type { SourceAdapter } from "./types";
import { adzunaSource } from "./sources/adzuna";
import { createAdpSource } from "./sources/adp";
import { createGreenhouseSource } from "./sources/greenhouse";
import { createUkgSource } from "./sources/ukg";
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
 *  - UKG Ready careers:  createUkgSource({ id, name, company, host, cid }).
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
  // Live-verified: returns ~38 trade listings from 137 requisitions.
  createAdpSource({
    id: "adp-suntex",
    name: "Suntex Marinas",
    company: "Suntex Marinas",
    cid: "08f6f0d8-fe33-401f-a518-03fc32c3ad35",
  }),
  // Safe Harbor Marinas runs UKG Ready (safeharbor.com/careers redirects into
  // secure4.saashr.com/ta/6166382.careers).
  // NOTE: secure4.saashr.com is reachable, but its robots.txt disallows all
  // non-Google crawlers, so this adapter fails fast and is skipped every run
  // (other sources untouched). Left registered on purpose — pending written
  // permission from Safe Harbor, after which it can be exempted like Adzuna.
  createUkgSource({
    id: "ukg-safeharbor",
    name: "Safe Harbor Marinas",
    company: "Safe Harbor Marinas",
    host: "secure4.saashr.com",
    cid: "6166382",
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
    // The whole per-source unit — fetch, upsert, and expire — is isolated: a
    // failure anywhere here (including a DB write) is logged and skipped so it
    // can never abort the run and starve the remaining sources. (The upsert and
    // expire calls used to sit outside this guard, so a single thrown Supabase
    // error would crash the entire pipeline.)
    try {
      const jobs = await adapter.fetchJobs();

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
    } catch (err) {
      console.error(`[${adapter.id}] FAILED, skipping (listings left untouched):`, err);
      continue;
    }
  }

  console.log(
    `Aggregation complete: ${created} new, ${updated} updated, ${expired} expired.`
  );
}

main().catch((err) => {
  // Surface the real reason instead of Node's bare "#<Object>" for a thrown
  // Supabase/PostgREST error object, and exit non-zero so CI flags the run.
  console.error("Aggregation crashed:", err);
  process.exitCode = 1;
});
