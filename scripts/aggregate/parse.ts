import type { NewJobInput } from "../../src/lib/jobs";
import {
  inferCategory,
  inferCertifications,
  stateCodeFromRegion,
} from "../../src/lib/taxonomy";

/**
 * schema.org JobPosting parsing.
 *
 * Most employer and association career pages embed listings as JSON-LD
 * (`<script type="application/ld+json">`) — structured data published expressly
 * for machines. Reading that is more robust and more polite than scraping
 * presentation markup, so it's our default ingestion path. Everything here is
 * pure (no network) so it can be unit-tested against fixtures.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Pull and JSON-parse every ld+json block from an HTML document. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites emit invalid JSON (trailing commas, HTML comments). Skip it.
    }
  }
  return blocks;
}

function typeIncludes(node: any, type: string): boolean {
  const t = node?.["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

/** Recursively collect JobPosting objects out of arbitrary JSON-LD shapes. */
export function collectJobPostings(node: unknown, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectJobPostings(item, out);
    return out;
  }
  const obj = node as any;
  if (typeIncludes(obj, "JobPosting")) out.push(obj);
  if (Array.isArray(obj["@graph"])) collectJobPostings(obj["@graph"], out);
  // ItemList of postings (common on listing index pages).
  if (Array.isArray(obj.itemListElement)) {
    for (const el of obj.itemListElement) collectJobPostings(el?.item ?? el, out);
  }
  return out;
}

/** Convenience: extract all JobPosting objects from a full HTML document. */
export function extractJobPostings(html: string): any[] {
  const out: any[] = [];
  for (const block of extractJsonLdBlocks(html)) collectJobPostings(block, out);
  return out;
}

function firstString(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return "";
}

/** Strip tags and decode the handful of entities employers actually emit. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function resolveUrl(url: string, pageUrl?: string): string {
  if (!url) return pageUrl ?? "";
  try {
    return new URL(url, pageUrl).toString();
  } catch {
    return url;
  }
}

interface SalaryParts {
  salary_min: number | null;
  salary_max: number | null;
  salary_unit: "YEAR" | "HOUR";
}

/**
 * An hourly wage never exceeds this; a full-time annual salary is never below
 * it. We use the gap to catch hourly rates that arrive labelled "per year" —
 * a common shape from aggregators (notably Adzuna) that don't carry a pay
 * period — so a $24/hr role isn't stored as a $24/year salary.
 */
export const MAX_PLAUSIBLE_HOURLY = 200;

/**
 * Plausible annual-salary band. Used to reject free-text figures that are
 * clearly not wages (a "$5,000,000 portfolio", a "$500 tool allowance") when we
 * fall back to reading pay out of the description prose.
 */
export const MIN_PLAUSIBLE_ANNUAL = 10_000;
export const MAX_PLAUSIBLE_ANNUAL = 1_000_000;

/** Reclassify an implausibly-low "annual" figure as hourly. No-op otherwise. */
export function sanitizeSalaryUnit(parts: SalaryParts): SalaryParts {
  if (parts.salary_unit === "HOUR") return parts;
  const ref = parts.salary_max ?? parts.salary_min;
  if (ref != null && ref <= MAX_PLAUSIBLE_HOURLY) {
    return { ...parts, salary_unit: "HOUR" };
  }
  return parts;
}

/** Normalize schema.org baseSalary to our annual/hourly model. */
export function parseSalary(baseSalary: any): SalaryParts {
  const empty: SalaryParts = { salary_min: null, salary_max: null, salary_unit: "YEAR" };
  if (!baseSalary || typeof baseSalary !== "object") return empty;
  const value = baseSalary.value ?? baseSalary;
  const num = (v: any) => {
    const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let min = num(value?.minValue);
  let max = num(value?.maxValue);
  const single = num(value?.value);
  if (min == null && max == null && single != null) min = max = single;
  if (min == null && max == null) return empty;

  const unitRaw = String(value?.unitText ?? baseSalary.unitText ?? "YEAR").toUpperCase();
  const isHour = unitRaw === "HOUR" || unitRaw === "HOURLY";
  // Annualize coarser-than-yearly periods so list pages compare like with like.
  const factor: Record<string, number> = { MONTH: 12, WEEK: 52, DAY: 260 };
  const mult = factor[unitRaw] ?? 1;
  const scale = (n: number | null) => (n == null ? null : Math.round(n * mult));

  return sanitizeSalaryUnit(
    isHour
      ? { salary_min: min, salary_max: max, salary_unit: "HOUR" }
      : { salary_min: scale(min), salary_max: scale(max), salary_unit: "YEAR" }
  );
}

/**
 * Best-effort salary from free text. Many employer pages omit structured
 * `baseSalary` but state pay in the description prose ("$28–$34/hr", "$65,000 to
 * $85,000 per year", "$90k DOE"). Reading it lifts the share of listings with
 * pay, which improves Google-for-Jobs eligibility and click-through.
 *
 * Deliberately conservative to avoid fabricating pay: a figure is only accepted
 * when the text names a pay period (hour/week/month/year) or uses a "k" salary
 * suffix, and figures outside the plausible wage bands are rejected — so
 * bonuses, prices and boat lengths aren't misread as salary. Returns the first
 * qualifying mention.
 */
export function parseSalaryFromText(text: string): SalaryParts {
  const empty: SalaryParts = { salary_min: null, salary_max: null, salary_unit: "YEAR" };
  if (!text) return empty;

  // A `$` amount with optional thousands separators / decimals and optional "k".
  const amt = String.raw`\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*(k)?`;
  // Optionally a second amount after a dash or "to" makes it a range. "and" is
  // intentionally excluded so unrelated figures ("$50,000 and a $2,000 bonus")
  // aren't fused into one bogus range.
  const re = new RegExp(`${amt}(?:\\s*(?:-|–|—|to)\\s*${amt})?`, "gi");

  const toNum = (digits: string, k?: string): number | null => {
    const n = parseFloat(digits.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return k ? n * 1000 : n;
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const first = toNum(m[1], m[2]);
    if (first == null) continue;
    const second = m[3] != null ? toNum(m[3], m[4]) : null;
    const hasK = Boolean(m[2] || m[4]);

    // The pay period usually trails the figure ("$28/hr", "$70,000 a year").
    const tail = text.slice(m.index, m.index + m[0].length + 24).toLowerCase();
    let period: "HOUR" | "WEEK" | "MONTH" | "YEAR" | null = null;
    if (/hour|hourly|\bhr\b|\/hr/.test(tail)) period = "HOUR";
    else if (/week|weekly|\/wk/.test(tail)) period = "WEEK";
    else if (/month|monthly|\/mo/.test(tail)) period = "MONTH";
    else if (/year|yearly|annual|annum|\/yr|salary/.test(tail)) period = "YEAR";
    else if (hasK) period = "YEAR"; // "$90k" is annual by convention.
    if (!period) continue; // No stated period → too risky to guess. Skip.

    const factor: Record<string, number> = { WEEK: 52, MONTH: 12 };
    const mult = factor[period] ?? 1;
    const scale = (n: number) => Math.round(n * mult);
    const unit: "YEAR" | "HOUR" = period === "HOUR" ? "HOUR" : "YEAR";
    const lo = scale(Math.min(first, second ?? first));
    const hi = scale(Math.max(first, second ?? first));

    const parts = sanitizeSalaryUnit({ salary_min: lo, salary_max: hi, salary_unit: unit });

    // Reject implausible magnitudes so stray large/small dollar amounts don't
    // land in a pay column.
    const ref = parts.salary_max ?? parts.salary_min!;
    const ok =
      parts.salary_unit === "HOUR"
        ? ref <= MAX_PLAUSIBLE_HOURLY
        : ref >= MIN_PLAUSIBLE_ANNUAL && ref <= MAX_PLAUSIBLE_ANNUAL;
    if (!ok) continue;
    return parts;
  }
  return empty;
}

function isUsAddress(address: any): boolean {
  const country = address?.addressCountry;
  const name = typeof country === "object" ? country?.name : country;
  if (!name) return true; // Assume US when unspecified — these are US trade sites.
  return /^(us|usa|united states)$/i.test(String(name).trim());
}

function parseLocation(jobLocation: any): { city: string; state: string } | null {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  for (const loc of locations) {
    const address = loc?.address ?? loc;
    if (!address || !isUsAddress(address)) continue;
    const state = stateCodeFromRegion(address.addressRegion);
    if (!state) continue;
    const city = firstString(address.addressLocality) || "—";
    return { city, state };
  }
  return null;
}

export interface ToInputOptions {
  /** Adapter id, stored as the listing's `source`. */
  source: string;
  /** URL of the page the posting was found on, for resolving relative links. */
  pageUrl?: string;
}

/**
 * Map one schema.org JobPosting to a NewJobInput, or null if it isn't a usable
 * US listing (no resolvable state, no title/company). The expiry date is
 * intentionally dropped: lifecycle is owned by the pipeline's expire pass.
 */
export function jobPostingToInput(posting: any, opts: ToInputOptions): NewJobInput | null {
  const title = firstString(posting?.title, posting?.name);
  const org = posting?.hiringOrganization;
  const company = firstString(typeof org === "object" ? org?.name : org, posting?.author);
  if (!title || !company) return null;

  const location = parseLocation(posting?.jobLocation);
  if (!location) return null;

  const description = htmlToText(firstString(posting?.description) || "");
  if (description.length < 20) return null;

  const employmentType = firstString(posting?.employmentType) || "FULL_TIME";
  const source_url = resolveUrl(firstString(posting?.url), opts.pageUrl);

  const haystack = [title, description];
  const datePosted = firstString(posting?.datePosted);

  // Prefer structured baseSalary; fall back to pay stated in the prose so
  // listings without a machine-readable salary still carry one.
  let salary = parseSalary(posting?.baseSalary);
  if (salary.salary_min == null && salary.salary_max == null) {
    salary = parseSalaryFromText(`${title} ${description}`);
  }

  return {
    title,
    company,
    city: location.city,
    state: location.state,
    category: inferCategory(title),
    employment_type: employmentType.toUpperCase().replace(/\s+/g, "_"),
    description,
    certifications: inferCertifications(...haystack),
    source: opts.source,
    source_url: source_url || null,
    posted_at: datePosted ? new Date(datePosted).toISOString() : new Date().toISOString(),
    ...salary,
  };
}

/** Full pipeline for one page of HTML: HTML → normalized listings. */
export function parseJobsFromHtml(html: string, opts: ToInputOptions): NewJobInput[] {
  return extractJobPostings(html)
    .map((p) => jobPostingToInput(p, opts))
    .filter((j): j is NewJobInput => j !== null);
}
