import {
  htmlContainsBadge,
  listDeclaredPlacements,
  markPlacementNotified,
  recordUnreachable,
  recordVerification,
} from "../../src/lib/badge-placements";
import { adminNotifyEmail, badgeMissingHtml, isEmailEnabled, sendEmail } from "../../src/lib/email";

/**
 * Badge verification — run weekly. For each page an employer has declared as the
 * home of their "We're Hiring" badge, fetch it and confirm the badge markup is
 * still there. When a badge goes missing, email the owner once (they decide
 * whether to pull the comped advertising). Transient errors (timeout, 5xx) are
 * recorded but never raise a false "missing" alert.
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

async function main() {
  const placements = await listDeclaredPlacements();
  if (placements.length === 0) {
    console.log("No declared badge placements to verify.");
    return;
  }

  const notifyTo = adminNotifyEmail();
  const canEmail = isEmailEnabled() && !!notifyTo;
  if (!canEmail) {
    console.warn(
      "Badge alerts NOT configured (need RESEND_API_KEY + LEADS_NOTIFY_EMAIL). " +
        "Statuses will still be recorded for the admin panel, but no email will be sent."
    );
  }

  let present = 0;
  let missing = 0;
  let unreachable = 0;
  let notified = 0;

  for (const p of placements) {
    const result = await fetchPage(p.page_url);

    if (!result.ok) {
      unreachable++;
      await recordUnreachable(p.id, result.status);
      console.log(`? ${p.company} — ${p.page_url} — ${result.status} (left unchanged)`);
      continue;
    }

    const found = htmlContainsBadge(result.html ?? "", p.employer_id);
    await recordVerification(p.id, found, found ? "ok" : "missing");

    if (found) {
      present++;
      console.log(`✓ ${p.company} — ${p.page_url}`);
      continue;
    }

    missing++;
    console.log(`✗ ${p.company} — ${p.page_url} — badge NOT found`);

    // Alert once per disappearance.
    if (p.notified_missing_at) continue;
    if (canEmail) {
      try {
        await sendEmail({
          to: notifyTo!,
          subject: `Badge missing on ${p.company}'s site`,
          html: badgeMissingHtml({
            company: p.company,
            pageUrl: p.page_url,
            employerId: p.employer_id,
            status: "badge not found on the submitted page",
          }),
        });
        await markPlacementNotified(p.id);
        notified++;
      } catch (err) {
        console.error(`Failed to email badge alert for ${p.company}:`, err);
      }
    }
  }

  console.log(
    `Badge verification complete: ${present} present, ${missing} missing, ` +
      `${unreachable} unreachable, ${notified} alert(s) emailed.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
