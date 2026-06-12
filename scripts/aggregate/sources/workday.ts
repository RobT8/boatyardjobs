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
 * Workday source adapter (direct from an employer running Workday careers).
 *
 * Workday sites expose an undocumented-but-stable JSON API ("CXS"):
 *   list:   POST https://{host}/wday/cxs/{tenant}/{site}/jobs
 *   detail: GET  https://{host}/wday/cxs/{tenant}/{site}{externalPath}
 * No key required. The list is paginated; we fetch detail per posting for the
 * description + canonical location, cap the volume, and throttle politely.
 *
 * NOTE: the {site} segment varies per employer and can't be verified offline —
 * confirm on the first real run and adjust if the list call 404s.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WorkdayConfig {
  id: string;
  name: string;
  company: string;
  /** e.g. "brunswick.wd1.myworkdayjobs.com" */
  host: string;
  /** e.g. "brunswick" */
  tenant: string;
  /** careers site id in the CXS path, e.g. "search" */
  site: string;
}

const PAGE = 20;
const MAX_JOBS = 150; // keep a daily run bounded and polite

function parseLocation(text: string): { city: string; state: string } | null {
  if (!text) return null;
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const state = stateCodeFromRegion(parts[i]);
    if (state) return { city: parts[0], state };
  }
  return null;
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function createWorkdaySource(config: WorkdayConfig): SourceAdapter {
  const base = `https://${config.host}/wday/cxs/${config.tenant}/${config.site}`;
  const headers = { "Content-Type": "application/json", Accept: "application/json" };

  return {
    id: config.id,
    name: config.name,
    url: `https://${config.host}`,
    async fetchJobs(): Promise<NewJobInput[]> {
      // 1) page through the listing
      const postings: { externalPath: string }[] = [];
      for (let offset = 0; offset < MAX_JOBS; offset += PAGE) {
        const res = await fetch(`${base}/jobs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ appliedFacets: {}, limit: PAGE, offset, searchText: "" }),
        });
        if (!res.ok) throw new Error(`workday ${config.tenant} list -> HTTP ${res.status}`);
        const json: any = await res.json();
        const batch: any[] = json?.jobPostings ?? [];
        for (const p of batch) if (p?.externalPath) postings.push({ externalPath: p.externalPath });
        const total: number = json?.total ?? 0;
        if (batch.length === 0 || offset + PAGE >= total) break;
        await delay(400);
      }

      // 2) fetch detail per posting for description + canonical location
      const out: NewJobInput[] = [];
      for (const p of postings) {
        try {
          const res = await fetch(`${base}${p.externalPath}`, { headers });
          if (!res.ok) continue;
          const info: any = (await res.json())?.jobPostingInfo;
          if (!info) continue;

          const location = parseLocation(String(info?.location ?? ""));
          if (!location) continue;
          const description = htmlToText(String(info?.jobDescription ?? ""));
          if (description.length < 20) continue;
          const title = String(info?.title ?? "").trim();
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
            source_url: String(info?.externalUrl ?? `https://${config.host}${p.externalPath}`),
            salary_unit: "YEAR",
            posted_at: info?.startDate ? new Date(info.startDate).toISOString() : new Date().toISOString(),
          });
        } catch {
          // skip a single bad detail fetch; keep going
        }
        await delay(300);
      }
      return out;
    },
  };
}
