import { getDb } from "../../src/lib/db";
import { insertJob, slugify } from "../../src/lib/jobs";
import type { SourceAdapter } from "./types";
import exampleAssociation from "./sources/example-association";

const ADAPTERS: SourceAdapter[] = [exampleAssociation];

/**
 * Aggregation entry point — run on a schedule (cron / GitHub Action):
 *   npm run aggregate
 *
 * Dedupe strategy: a job is "the same" if its derived slug base matches an
 * existing listing from the same source. Existing rows are refreshed
 * (kept published); rows that disappear upstream should eventually be expired —
 * that pass is TODO until the first real adapter lands.
 */
async function main() {
  const db = getDb();
  let inserted = 0;

  for (const adapter of ADAPTERS) {
    console.log(`[${adapter.id}] fetching…`);
    let jobs;
    try {
      jobs = await adapter.fetchJobs();
    } catch (err) {
      console.error(`[${adapter.id}] FAILED:`, err);
      continue;
    }

    for (const job of jobs) {
      const base = slugify(`${job.title} ${job.company} ${job.city} ${job.state}`);
      const existing = db
        .prepare("SELECT id FROM jobs WHERE source = ? AND slug LIKE ?")
        .get(adapter.id, `${base}%`);
      if (existing) continue;
      insertJob({ ...job, source: adapter.id });
      inserted++;
    }
    console.log(`[${adapter.id}] done — ${jobs.length} fetched`);
  }

  console.log(`Aggregation complete: ${inserted} new jobs inserted.`);
}

main();
