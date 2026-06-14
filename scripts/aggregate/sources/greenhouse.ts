import type { SourceAdapter } from "../types";
import { assertCrawlable } from "../robots";
import { htmlToText } from "../parse";
import type { NewJobInput } from "../../../src/lib/jobs";
import {
  inferCategory,
  inferCertifications,
  isTradeRole,
  stateCodeFromRegion,
} from "../../../src/lib/taxonomy";

/**
 * Greenhouse source adapter (direct from an employer's own job board).
 *
 * Greenhouse exposes a free, public, ToS-friendly JSON API per company:
 *   https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 * No key required. We read it, normalize, and keep the employer's own apply URL
 * as source_url. Add an employer by appending a config in run.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GreenhouseConfig {
  /** Stored as the listing source, e.g. "gh-arcboatcompany". */
  id: string;
  name: string;
  /** Employer display name (Greenhouse jobs don't reliably carry it). */
  company: string;
  /** Greenhouse board token, e.g. "arcboatcompany". */
  token: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Parse "City, ST" / "City, State" into our city + 2-letter state, or null. */
function parseLocation(name: string): { city: string; state: string } | null {
  if (!name) return null;
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const state = stateCodeFromRegion(parts[i]);
    if (state) return { city: parts[0], state };
  }
  return null;
}

export function createGreenhouseSource(config: GreenhouseConfig): SourceAdapter {
  return {
    id: config.id,
    name: config.name,
    url: `https://job-boards.greenhouse.io/${config.token}`,
    async fetchJobs(): Promise<NewJobInput[]> {
      const url = `https://boards-api.greenhouse.io/v1/boards/${config.token}/jobs?content=true`;
      await assertCrawlable(url); // honor robots.txt
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`greenhouse ${config.token} -> HTTP ${res.status}`);
      const json: any = await res.json();

      const out: NewJobInput[] = [];
      for (const j of json?.jobs ?? []) {
        const location = parseLocation(j?.location?.name ?? "");
        if (!location) continue; // skip remote / non-US (board is state-organized)
        const description = htmlToText(decodeEntities(String(j?.content ?? "")));
        if (description.length < 20) continue;
        const title = String(j?.title ?? "").trim();
        if (!title || !isTradeRole(title)) continue; // trades only, not corporate roles

        const haystack = `${title} ${description}`;
        out.push({
          title,
          company: config.company,
          city: location.city,
          state: location.state,
          category: inferCategory(title),
          description,
          certifications: inferCertifications(haystack),
          source: config.id,
          source_url: j?.absolute_url ? String(j.absolute_url) : null,
          salary_unit: "YEAR",
          posted_at: j?.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(),
        });
      }
      return out;
    },
  };
}
