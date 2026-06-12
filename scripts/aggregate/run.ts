import { upsertSourcedJob, expireMissingFromSource } from "../../src/lib/jobs";
import type { SourceAdapter } from "./types";
import { createJsonLdSource } from "./sources/jsonld";
import exampleAssociation from "./sources/example-association";

/**
 * Source registry. Add a real board here:
 *  - Most sites publish schema.org JobPosting JSON-LD → use createJsonLdSource.
 *  - Sites without structured data → copy example-association.ts and hand-parse.
 *
 * The example adapters below return nothing; they're templates. Replace the
 * `url`/`pages` with a real listings page to switch the board on.
 */
const ADAPTERS: SourceAdapter[] = [
  createJsonLdSource({
    id: "example-jsonld",
    name: "Example Marine Trades Association (JSON-LD)",
    url: "https://example.org/careers",
  }),
  exampleAssociation,
];

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
      const result = upsertSourcedJob({ ...job, source: adapter.id });
      if (job.source_url) seenUrls.push(job.source_url);
      if (result === "created") srcCreated++;
      else if (result === "updated") srcUpdated++;
    }

    const srcExpired = expireMissingFromSource(adapter.id, seenUrls);
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
