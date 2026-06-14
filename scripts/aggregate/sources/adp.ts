import type { SourceAdapter } from "../types";
import { assertCrawlable, isAllowed } from "../robots";
import { htmlToText } from "../parse";
import type { NewJobInput } from "../../../src/lib/jobs";
import {
  inferCategory,
  inferCertifications,
  isTradeRole,
  stateCodeFromRegion,
} from "../../../src/lib/taxonomy";

/**
 * ADP Workforce Now source adapter (direct from an employer running the ADP
 * "Career Center" recruiting module).
 *
 * ADP exposes a public, key-free JSON API for a company's open requisitions:
 *   list:   GET {BASE}/job-requisitions?cid={cid}&$top=N&$skip=M
 *   detail: GET {BASE}/job-requisitions/{itemID}?cid={cid}
 * where BASE = https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1
 * The `cid` (client GUID) is the value in the public careers URL a company links
 * to, e.g. Suntex Marinas:
 *   https://workforcenow.adp.com/.../recruitment.html?cid=08f6f0d8-...&ccId=19000101_000001
 *
 * IMPORTANT — two things to confirm on the first real run:
 *  1. Egress: `workforcenow.adp.com` must be reachable from the aggregation
 *     environment. It is NOT in the default network allowlist; add it there or
 *     this adapter will fail fast (and run.ts will skip it, leaving other
 *     sources untouched).
 *  2. Field shape: ADP returns slightly different JSON across tenants (the list
 *     array is usually `jobRequisitions`, occasionally `requisitionListItems`;
 *     the description may live only on the detail call). The parser below is
 *     deliberately tolerant of these variants — verify against the live payload
 *     and tighten if needed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AdpConfig {
  /** Stored as the listing source, e.g. "adp-suntex". */
  id: string;
  name: string;
  /** Employer display name (requisitions don't reliably carry it). */
  company: string;
  /** Client GUID — the `cid` in the public careers URL. */
  cid: string;
  /**
   * Career-center id — the `ccId` in the public careers URL. ADP public career
   * centers overwhelmingly use this constant; override only if a tenant differs.
   */
  ccId?: string;
  /** Olson timezone the feed is queried in. Defaults to US Central. */
  timeZoneId?: string;
}

const HOST = "workforcenow.adp.com";
const BASE = `https://${HOST}/mascsr/default/careercenter/public/events/staffing/v1`;
const DEFAULT_CC_ID = "19000101_000001";

const PAGE = 20;
const MAX_JOBS = 200; // keep a daily run bounded and polite

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** First non-empty string found at any of the given values. */
function pick(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

/**
 * Resolve a requisition's location to our city + 2-letter state.
 * ADP nests address as requisitionLocations[].address.{cityName,
 * countrySubdivisionLevel1.{codeValue|shortName}, countryCode}. We also accept a
 * couple of flatter variants other tenants emit.
 */
function parseLocation(req: any): { city: string; state: string } | null {
  const locs: any[] = req?.requisitionLocations ??
    (req?.requisitionLocation ? [req.requisitionLocation] : []);
  for (const loc of locs) {
    const addr = loc?.address ?? loc;
    const country = pick(
      addr?.countryCode,
      typeof addr?.country === "object" ? addr?.country?.codeValue : addr?.country
    );
    if (country && !/^(us|usa|united states)$/i.test(country)) continue;

    const sub = addr?.countrySubdivisionLevel1 ?? {};
    const state = stateCodeFromRegion(
      pick(sub?.codeValue, sub?.shortName, addr?.stateProvince, addr?.region)
    );
    if (!state) continue;
    const city = pick(addr?.cityName, addr?.city, loc?.nameCode?.shortName) || "—";
    return { city, state };
  }
  return null;
}

/** Best-effort human-facing apply URL for a single requisition. */
function applyUrl(cid: string, ccId: string, reqId: string): string {
  const params = new URLSearchParams({
    cid,
    ccId,
    type: "MP",
    lang: "en_US",
    selectedMenuKey: "CurrentOpenings",
  });
  if (reqId) params.set("jobId", reqId);
  return `https://${HOST}/mascsr/default/mdf/recruitment/recruitment.html?${params}`;
}

export function createAdpSource(config: AdpConfig): SourceAdapter {
  const ccId = config.ccId ?? DEFAULT_CC_ID;
  const tz = config.timeZoneId ?? "America/Chicago";
  const headers = { Accept: "application/json" };
  const common = `cid=${encodeURIComponent(config.cid)}&timeZoneId=${encodeURIComponent(tz)}&locale=en_US`;

  return {
    id: config.id,
    name: config.name,
    url: applyUrl(config.cid, ccId, ""),
    async fetchJobs(): Promise<NewJobInput[]> {
      // 1) page through the requisition list
      await assertCrawlable(`${BASE}/job-requisitions?${common}`); // honor robots.txt
      const reqs: any[] = [];
      for (let skip = 0; skip < MAX_JOBS; skip += PAGE) {
        const url = `${BASE}/job-requisitions?${common}&%24top=${PAGE}&%24skip=${skip}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`adp ${config.cid} list -> HTTP ${res.status}`);
        const json: any = await res.json();
        const batch: any[] = json?.jobRequisitions ?? json?.requisitionListItems ?? [];
        reqs.push(...batch);
        const total: number = Number(
          json?.meta?.totalNumber ?? json?.meta?.totalRecords ?? 0
        );
        if (batch.length < PAGE || (total && skip + PAGE >= total)) break;
        await delay(400);
      }

      // 2) per requisition, fetch detail for the full description when the list
      //    item doesn't already carry one, then normalize.
      const out: NewJobInput[] = [];
      for (const listItem of reqs) {
        const reqId = pick(
          listItem?.itemID,
          listItem?.requisitionId,
          listItem?.requisitionID
        );
        const title = pick(listItem?.requisitionTitle, listItem?.title);
        if (!title || !isTradeRole(title)) continue; // trades only, not hospitality/admin

        let req = listItem;
        let description = htmlToText(
          pick(
            listItem?.requisitionDescription,
            listItem?.jobDescription,
            listItem?.description
          )
        );
        if (description.length < 20 && reqId) {
          try {
            const detailUrl = `${BASE}/job-requisitions/${encodeURIComponent(reqId)}?${common}`;
            const res = (await isAllowed(detailUrl)) ? await fetch(detailUrl, { headers }) : null;
            if (res?.ok) {
              const detail: any = await res.json();
              req = detail?.jobRequisition ?? detail ?? listItem;
              description = htmlToText(
                pick(
                  req?.requisitionDescription,
                  req?.jobDescription,
                  req?.description,
                  detail?.requisitionDescription
                )
              );
            }
            await delay(300);
          } catch {
            // skip a single bad detail fetch; keep going with what we have
          }
        }
        if (description.length < 20) continue;

        const location = parseLocation(req) ?? parseLocation(listItem);
        if (!location) continue; // need a resolvable US state

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
          source_url: pick(req?.canonicalUrl, req?.applyUrl) || applyUrl(config.cid, ccId, reqId),
          salary_unit: "YEAR",
          posted_at: (() => {
            const d = pick(
              req?.requisitionPostingDate,
              listItem?.requisitionPostingDate,
              req?.postDate,
              req?.firstPublishedDate
            );
            const t = d ? Date.parse(d) : NaN;
            return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
          })(),
        });
      }
      return out;
    },
  };
}
