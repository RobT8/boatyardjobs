import type { SourceAdapter } from "../types";
import { htmlToText } from "../parse";
import type { NewJobInput } from "../../../src/lib/jobs";
import {
  inferCategory,
  inferCertifications,
  isTradeRole,
  stateCodeFromRegion,
} from "../../../src/lib/taxonomy";

/**
 * Lever source adapter (direct from an employer's own Lever board).
 *
 * Lever exposes a free, public, ToS-friendly JSON API per company:
 *   https://api.lever.co/v0/postings/{site}?mode=json
 * No key required. We read it, normalize, and keep the employer's own hosted
 * URL as source_url. Add an employer by appending a config in run.ts.
 *
 * The {site} token is the slug in jobs.lever.co/{site}; confirm it on the first
 * real run (a wrong token returns HTTP 404, and the source is skipped safely).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LeverConfig {
  /** Stored as the listing source, e.g. "lever-somecompany". */
  id: string;
  name: string;
  /** Employer display name. */
  company: string;
  /** Lever site token, e.g. "somecompany" from jobs.lever.co/somecompany. */
  site: string;
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

export function createLeverSource(config: LeverConfig): SourceAdapter {
  return {
    id: config.id,
    name: config.name,
    url: `https://jobs.lever.co/${config.site}`,
    async fetchJobs(): Promise<NewJobInput[]> {
      const url = `https://api.lever.co/v0/postings/${config.site}?mode=json`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`lever ${config.site} -> HTTP ${res.status}`);
      const json: any = await res.json();

      const out: NewJobInput[] = [];
      for (const j of Array.isArray(json) ? json : []) {
        const location = parseLocation(String(j?.categories?.location ?? ""));
        if (!location) continue; // skip remote / non-US (parser is state-organized)
        // descriptionPlain is preferred; htmlToText also handles the HTML form.
        const description = htmlToText(String(j?.descriptionPlain ?? j?.description ?? ""));
        if (description.length < 20) continue;
        const title = String(j?.text ?? "").trim();
        if (!title || !isTradeRole(title)) continue; // trades only, not corporate roles

        const haystack = `${title} ${description}`;
        out.push({
          title,
          company: config.company,
          city: location.city,
          state: location.state,
          category: inferCategory(title),
          employment_type: /part/i.test(String(j?.categories?.commitment ?? ""))
            ? "PART_TIME"
            : "FULL_TIME",
          description,
          certifications: inferCertifications(haystack),
          source: config.id,
          source_url: j?.hostedUrl
            ? String(j.hostedUrl)
            : j?.applyUrl
              ? String(j.applyUrl)
              : null,
          salary_unit: "YEAR",
          posted_at: j?.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
        });
      }
      return out;
    },
  };
}
