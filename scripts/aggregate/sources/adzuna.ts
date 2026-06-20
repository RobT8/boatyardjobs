import type { SourceAdapter } from "../types";
import { htmlToText, sanitizeSalaryUnit } from "../parse";
import type { NewJobInput } from "../../../src/lib/jobs";
import {
  inferCategory,
  inferCertifications,
  isTradeRole,
  stateCodeFromRegion,
} from "../../../src/lib/taxonomy";

/**
 * Adzuna source adapter.
 *
 * Adzuna provides an official, documented Jobs API (https://developer.adzuna.com)
 * that legally aggregates listings from across the web. We query marine-trade
 * terms nationwide (US), keep each job's Adzuna redirect URL as `source_url` so
 * applications go back through the source (their attribution requirement), and
 * normalize results into our schema.
 *
 * Requires env: ADZUNA_APP_ID, ADZUNA_APP_KEY (free at developer.adzuna.com).
 *
 * NOTE: this adapter intentionally does NOT consult robots.txt. We reach Adzuna
 * through its official, key-authenticated Jobs API under a usage agreement —
 * robots.txt governs crawling, not licensed API access (api.adzuna.com/robots.txt
 * disallows everything, which would wrongly disable an authorized integration).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Cover every role category in our taxonomy plus high-volume generics. Each
// result is still gated by isTradeRole(title) + MARINE_RE below, so broad terms
// can't pull in off-topic listings.
const SEARCH_TERMS = [
  // technician / mechanic (highest volume)
  "marine technician",
  "boat mechanic",
  "marine mechanic",
  "marine diesel mechanic",
  "outboard technician",
  "boat technician",
  // electrical
  "marine electrician",
  "marine electronics installer",
  // fiberglass & gelcoat
  "fiberglass boat repair",
  "gelcoat technician",
  "boat builder",
  // rigging
  "sailboat rigger",
  // canvas & upholstery
  "marine canvas",
  "marine upholstery",
  // detailing
  "boat detailer",
  // yard & marina
  "boatyard",
  "marina technician",
  "marina dockhand",
  "travel lift operator",
  // service desk
  "marine service writer",
  "marine service manager",
  // general
  "yacht service",
];

// A result must look marine-related, and not be a false-positive ("Marine Corps").
const MARINE_RE = /\b(boat|boats|marine|yacht|marina|outboard|sterndrive|vessel|rigging|gelcoat|nautical|watercraft|dockhand)\b/i;
const EXCLUDE_RE = /\b(marine corps|submarine|marine biolog|aquarium|merchant marine|naval)\b/i;

const RESULTS_PER_PAGE = 50;
// Deepen pagination for high-volume terms. Narrow terms stop early (see the
// short-page break below), so this only spends extra API calls where there are
// actually more results to fetch.
const PAGES_PER_TERM = 3;

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function parseLocation(loc: any): { city: string; state: string } | null {
  const area: string[] = Array.isArray(loc?.area) ? loc.area : [];
  // area is hierarchical, e.g. ["US", "Florida", "Miami-Dade County", "Miami"].
  const state = stateCodeFromRegion(area[1]);
  if (!state) return null;
  const city = area.length > 2 ? area[area.length - 1] : (loc?.display_name ?? "—");
  return { city, state };
}

function toInput(r: any): NewJobInput | null {
  const title = String(r?.title ?? "").trim();
  const company = String(r?.company?.display_name ?? "").trim();
  const description = htmlToText(String(r?.description ?? ""));
  if (!title || !company || description.length < 20) return null;

  const haystack = `${title} ${description}`;
  if (!MARINE_RE.test(haystack) || EXCLUDE_RE.test(haystack)) return null;
  if (!isTradeRole(title)) return null; // keep trade roles, drop marine sales/admin

  const location = parseLocation(r?.location);
  if (!location) return null;

  // Adzuna flags estimated salaries; only keep employer-stated figures.
  const predicted = String(r?.salary_is_predicted ?? "0") === "1";
  const rawMin = !predicted && r?.salary_min ? Math.round(Number(r.salary_min)) : null;
  const rawMax = !predicted && r?.salary_max ? Math.round(Number(r.salary_max)) : null;
  // Adzuna reports no pay period; relabel hourly-magnitude figures as hourly.
  const { salary_min, salary_max, salary_unit } = sanitizeSalaryUnit({
    salary_min: rawMin,
    salary_max: rawMax,
    salary_unit: "YEAR",
  });

  return {
    title,
    company,
    city: location.city,
    state: location.state,
    category: inferCategory(title),
    employment_type: r?.contract_time === "part_time" ? "PART_TIME" : "FULL_TIME",
    description,
    salary_min,
    salary_max,
    salary_unit,
    certifications: inferCertifications(haystack),
    source: "adzuna",
    source_url: r?.redirect_url ? String(r.redirect_url) : null,
    posted_at: r?.created ? new Date(r.created).toISOString() : new Date().toISOString(),
  };
}

export function adzunaSource(): SourceAdapter {
  const appId = process.env.ADZUNA_APP_ID!;
  const appKey = process.env.ADZUNA_APP_KEY!;

  return {
    id: "adzuna",
    name: "Adzuna (US marine trades)",
    url: "https://www.adzuna.com",
    async fetchJobs(): Promise<NewJobInput[]> {
      const byUrl = new Map<string, NewJobInput>();

      for (const term of SEARCH_TERMS) {
        for (let page = 1; page <= PAGES_PER_TERM; page++) {
          const params = new URLSearchParams({
            app_id: appId,
            app_key: appKey,
            results_per_page: String(RESULTS_PER_PAGE),
            what: term,
            "content-type": "application/json",
          });
          const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?${params}`;

          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) {
            console.warn(`[adzuna] "${term}" p${page} -> HTTP ${res.status}`);
            break; // move on to the next term
          }
          const json: any = await res.json();
          const results: any[] = json?.results ?? [];
          for (const r of results) {
            const job = toInput(r);
            if (job?.source_url && !byUrl.has(job.source_url)) byUrl.set(job.source_url, job);
          }
          // Last page for this term — no point requesting further pages.
          if (results.length < RESULTS_PER_PAGE) break;
          await delay(1500); // be gentle on the API / stay within rate limits
        }
      }

      return [...byUrl.values()];
    },
  };
}
