import {
  getDeclaredPlacement,
  htmlContainsBadge,
  listDeclaredPlacements,
  markPlacementNotified,
  recordUnreachable,
  recordVerification,
  type BadgePlacement,
  type PlacementWithCompany,
} from "./badge-placements";
import { getEmployerById } from "./employers";
import { adminNotifyEmail, badgeMissingHtml, isEmailEnabled, sendEmail } from "./email";

/**
 * Shared badge-verification logic, used by both the weekly cron
 * (`scripts/badge/verify.ts`) and the admin "Check now" button
 * (`/api/admin/verify-badge`). Fetches the page an employer declared, confirms
 * the badge markup is present, records the result, and alerts the owner once
 * when a badge goes missing. Transient errors never flip a badge to "missing"
 * or fire a false alert.
 */

const FETCH_TIMEOUT_MS = 15_000;
const UA = "BoatyardJobsBadgeBot/1.0 (+https://www.boatyardjobs.com)";

async function fetchPage(url: string): Promise<{ ok: boolean; status: string; html?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return { ok: false, status: `http ${res.status}` };
    return { ok: true, status: "ok", html: await res.text() };
  } catch (err) {
    const msg = err instanceof Error ? err.name : "error";
    return { ok: false, status: `unreachable (${msg})` };
  } finally {
    clearTimeout(timer);
  }
}

export type VerifyOutcome = "present" | "missing" | "unreachable";

export interface VerifyResult {
  outcome: VerifyOutcome;
  status: string;
  /** True when this check sent a "badge missing" alert email. */
  alerted: boolean;
}

/** Verify a single declared placement: fetch, record, and alert if newly missing. */
export async function verifyPlacement(p: PlacementWithCompany): Promise<VerifyResult> {
  const result = await fetchPage(p.page_url);

  if (!result.ok) {
    await recordUnreachable(p.id, result.status);
    return { outcome: "unreachable", status: result.status, alerted: false };
  }

  const found = htmlContainsBadge(result.html ?? "", p.employer_id);
  await recordVerification(p.id, found, found ? "ok" : "missing");
  if (found) return { outcome: "present", status: "ok", alerted: false };

  // Missing — alert the owner once per disappearance.
  let alerted = false;
  const notifyTo = adminNotifyEmail();
  if (!p.notified_missing_at && isEmailEnabled() && notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        subject: `Badge missing on ${p.company}'s site`,
        html: badgeMissingHtml({
          company: p.company,
          pageUrl: p.page_url,
          employerId: p.employer_id,
          status: "badge not found on the submitted page",
        }),
      });
      await markPlacementNotified(p.id);
      alerted = true;
    } catch {
      // Recorded as missing regardless; the admin panel still shows it.
    }
  }
  return { outcome: "missing", status: "missing", alerted };
}

export interface VerifySummary {
  present: number;
  missing: number;
  unreachable: number;
  alerted: number;
  checked: number;
}

/** Verify every declared placement (the weekly cron). */
export async function verifyAllDeclared(
  log: (line: string) => void = () => {}
): Promise<VerifySummary> {
  const placements = await listDeclaredPlacements();
  const sum: VerifySummary = { present: 0, missing: 0, unreachable: 0, alerted: 0, checked: 0 };
  for (const p of placements) {
    const r = await verifyPlacement(p);
    sum.checked++;
    sum[r.outcome]++;
    if (r.alerted) sum.alerted++;
    const mark = r.outcome === "present" ? "✓" : r.outcome === "missing" ? "✗" : "?";
    log(`${mark} ${p.company} — ${p.page_url} — ${r.status}`);
  }
  return sum;
}

/** Verify one employer's declared placement on demand (admin "Check now").
 *  Returns null if the employer hasn't submitted a page. */
export async function verifyEmployer(employerId: number): Promise<VerifyResult | null> {
  const placement: BadgePlacement | null = await getDeclaredPlacement(employerId);
  if (!placement) return null;
  const employer = await getEmployerById(employerId);
  const withCompany: PlacementWithCompany = { ...placement, company: employer?.company ?? "—" };
  return verifyPlacement(withCompany);
}
