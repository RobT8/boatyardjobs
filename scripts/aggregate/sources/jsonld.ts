import type { SourceAdapter } from "../types";
import { politeFetch } from "../types";
import { parseJobsFromHtml } from "../parse";
import type { NewJobInput } from "../../../src/lib/jobs";

export interface JsonLdSourceConfig {
  id: string;
  name: string;
  /** Homepage of the source, for attribution. */
  url: string;
  /**
   * Page(s) to fetch and scan for schema.org JobPosting JSON-LD. Defaults to
   * `[url]`. Use this when a board paginates or splits listings across an index
   * plus per-job detail pages.
   */
  pages?: string[];
}

/**
 * Build a SourceAdapter that ingests any site publishing schema.org JobPosting
 * structured data — the common case for boards built on WordPress job plugins,
 * Greenhouse/Lever embeds, and most modern ATS-backed career pages.
 *
 * Add a real source by appending a config to the registry in `run.ts`; no
 * bespoke parser needed unless a site lacks JSON-LD (then copy
 * `example-association.ts` and hand-parse).
 */
export function createJsonLdSource(config: JsonLdSourceConfig): SourceAdapter {
  return {
    id: config.id,
    name: config.name,
    url: config.url,
    async fetchJobs(): Promise<NewJobInput[]> {
      const pages = config.pages?.length ? config.pages : [config.url];
      const all: NewJobInput[] = [];
      const seen = new Set<string>();
      for (const page of pages) {
        const html = await politeFetch(page);
        for (const job of parseJobsFromHtml(html, { source: config.id, pageUrl: page })) {
          // Dedupe within a run when the same listing appears on multiple pages.
          const key = job.source_url ?? `${job.title}|${job.company}|${job.city}`;
          if (seen.has(key)) continue;
          seen.add(key);
          all.push(job);
        }
      }
      return all;
    },
  };
}
