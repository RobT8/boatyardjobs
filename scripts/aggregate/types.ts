import type { NewJobInput } from "../../src/lib/jobs";

/**
 * A source adapter fetches listings from one upstream site (state marine trades
 * association board, boatyard careers page, etc.) and normalizes them.
 *
 * Ground rules for every adapter:
 *  - Respect robots.txt and identify ourselves with a real User-Agent.
 *  - Always set `source` (the adapter id) and `source_url` (the original listing)
 *    so candidates apply on the employer's own page.
 *  - Throttle: one request at a time, >= 2s apart. These are small association
 *    sites; we must be a polite guest.
 */
export interface SourceAdapter {
  id: string;
  name: string;
  /** Homepage of the source, for attribution. */
  url: string;
  fetchJobs(): Promise<NewJobInput[]>;
}

export const USER_AGENT =
  "BoatyardJobsBot/0.1 (+https://boatyardjobs.com/about-our-crawler)";

export async function politeFetch(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  await new Promise((r) => setTimeout(r, 2000));
  return res.text();
}
