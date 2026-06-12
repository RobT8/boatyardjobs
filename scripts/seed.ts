import { listJobs, insertJob } from "../src/lib/jobs";
import { SEED_JOBS } from "../src/lib/seedData";

/**
 * One-time demo seed. Idempotent: skips if the board already has listings.
 * Run with credentials in the environment, e.g.:
 *   tsx --env-file=.env.local scripts/seed.ts
 */
async function main() {
  const { total } = await listJobs({ limit: 1 });
  if (total > 0) {
    console.log(`Jobs already present (${total}); skipping seed.`);
    return;
  }
  let n = 0;
  for (const job of SEED_JOBS) {
    await insertJob(job);
    n++;
  }
  console.log(`Seeded ${n} demo jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
