import type { SourceAdapter } from "../types";
import { USER_AGENT } from "../types";
import { parseJobsFromHtml } from "../parse";
import { isTradeRole } from "../../../src/lib/taxonomy";
import type { NewJobInput } from "../../../src/lib/jobs";

/**
 * UKG Ready (formerly Kronos Workforce Ready / SaaShr) source adapter.
 *
 * UKG Ready hosts an employer's public careers portal at:
 *   listing: https://{host}/ta/{cid}.careers?CareersSearch=
 *   detail:  https://{host}/ta/{cid}.careers?ShowJob={requisitionId}
 * where {host} is a data-center host (e.g. "secure4.saashr.com") and {cid} is the
 * company's short id. Safe Harbor Marinas, for example, is 6166382 on secure4
 * (from safeharbor.com/careers, which redirects into this portal).
 *
 * The detail pages are server-rendered and indexed by Google Jobs, so they carry
 * schema.org JobPosting JSON-LD — we reuse the shared JSON-LD pipeline
 * (`parseJobsFromHtml`) rather than scraping presentation markup. We discover
 * each posting from the listing page, fetch its detail page, and normalize.
 *
 * IMPORTANT — confirm on the first real run:
 *  1. Egress: `{host}` (e.g. secure4.saashr.com) must be in the aggregation
 *     network allowlist. It is NOT by default; until added this adapter fails
 *     fast and run.ts skips it (other sources untouched).
 *  2. Shape: if a given tenant renders listings client-side (no JSON-LD in the
 *     detail HTML) or paginates the listing, this yields nothing / a partial set
 *     — verify against the live portal and adjust (paging param / REST feed).
 */
const MAX_JOBS = 150; // bound a daily run; tune if a tenant lists more
const THROTTLE_MS = 1500; // be a polite guest on a careers portal

export interface UkgConfig {
  /** Stored as the listing source, e.g. "ukg-safeharbor". */
  id: string;
  name: string;
  /** Employer display name; used only as a fallback if JSON-LD omits it. */
  company: string;
  /** Data-center host, e.g. "secure4.saashr.com". */
  host: string;
  /** Company short id in the /ta/{cid}.careers path, e.g. "6166382". */
  cid: string;
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function createUkgSource(config: UkgConfig): SourceAdapter {
  const careers = (query: string) =>
    `https://${config.host}/ta/${config.cid}.careers?${query}`;
  const headers = { "User-Agent": USER_AGENT };

  return {
    id: config.id,
    name: config.name,
    url: careers("CareersSearch=&lang=en-US"),
    async fetchJobs(): Promise<NewJobInput[]> {
      // 1) listing page -> the set of requisition ids (ShowJob=NNN)
      const listRes = await fetch(careers("CareersSearch=&lang=en-US"), { headers });
      if (!listRes.ok) throw new Error(`ukg ${config.cid} list -> HTTP ${listRes.status}`);
      const listHtml = await listRes.text();

      const ids: string[] = [];
      const seenIds = new Set<string>();
      const re = /ShowJob=(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(listHtml)) && ids.length < MAX_JOBS) {
        if (!seenIds.has(m[1])) {
          seenIds.add(m[1]);
          ids.push(m[1]);
        }
      }

      // 2) per posting: fetch detail page, parse JSON-LD, keep trade roles only
      const out: NewJobInput[] = [];
      const seenUrls = new Set<string>();
      for (const id of ids) {
        const pageUrl = careers(`ShowJob=${id}&lang=en-US`);
        try {
          const res = await fetch(pageUrl, { headers });
          if (res.ok) {
            const html = await res.text();
            for (const job of parseJobsFromHtml(html, { source: config.id, pageUrl })) {
              if (!isTradeRole(job.title)) continue; // drop office/management roles
              const key = job.source_url ?? `${job.title}|${job.city}|${job.state}`;
              if (seenUrls.has(key)) continue;
              seenUrls.add(key);
              out.push({
                ...job,
                company: job.company || config.company,
                source: config.id,
                source_url: job.source_url ?? pageUrl,
              });
            }
          }
        } catch {
          // skip a single bad detail fetch; keep going
        }
        await delay(THROTTLE_MS);
      }
      return out;
    },
  };
}
