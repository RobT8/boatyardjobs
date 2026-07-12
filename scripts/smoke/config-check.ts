/**
 * Config & data-integrity checks for the P0s that a browser test can't see:
 *   1.2 / 1.4  Stripe webhook endpoint is on the www host + subscribed to the
 *              four events the code handles.
 *   1.6        The migrations the app depends on are actually applied (columns
 *              and tables exist).
 *   A2         `jobs.listing_rank` is populated and in-range, so the board's
 *              featured → direct → scraped ordering holds.
 *
 * Read-only. Emails LEADS_NOTIFY_EMAIL if anything is wrong. Run by the smoke
 * GitHub Action and via `npm run smoke:config`.
 */
import { getDb } from "../../src/lib/db";
import { getStripe, isStripeEnabled } from "../../src/lib/stripe";
import { sendEmail, isEmailEnabled, adminNotifyEmail, siteUrl } from "../../src/lib/email";

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.deleted",
];

/** Columns/tables each migration should have added. */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  jobs: ["listing_rank", "expiry_warned_at", "street_address", "postal_code"],
  ads: ["expiry_warned_at"],
  alerts: ["city"],
  employers: ["enhanced_profile", "about"],
  discount_codes: ["id", "code", "percent_off"],
  badge_placements: ["id", "employer_id", "present"],
  smoke_runs: ["id", "ok", "results"],
};

async function checkMigrations(issues: string[]) {
  const db = getDb();
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    const { error } = await db.from(table).select(cols.join(",")).limit(1);
    if (error) issues.push(`Migration gap: ${table}(${cols.join(", ")}) — ${error.message}`);
  }
}

async function checkListingRank(issues: string[]) {
  const { data, error } = await getDb()
    .from("jobs")
    .select("listing_rank")
    .eq("status", "published")
    .limit(2000);
  if (error) {
    issues.push(`Could not read listing_rank: ${error.message}`);
    return;
  }
  const bad = (data ?? []).filter(
    (r: { listing_rank: number | null }) => r.listing_rank == null || ![0, 1, 2].includes(r.listing_rank),
  );
  if (bad.length) {
    issues.push(`A2: ${bad.length} published job(s) have a null/out-of-range listing_rank — board order will be wrong.`);
  }
}

async function checkStripeWebhook(issues: string[]) {
  if (!isStripeEnabled()) {
    console.warn("STRIPE_SECRET_KEY not set — skipping webhook endpoint check.");
    return;
  }
  const expectedHost = new URL(siteUrl()).host; // canonical www host
  const { data: endpoints } = await getStripe().webhookEndpoints.list({ limit: 100 });
  const enabled = endpoints.filter((e) => e.status === "enabled");

  const onWww = enabled.find(
    (e) => e.url.includes(expectedHost) && e.url.includes("/api/stripe/webhook"),
  );
  if (!onWww) {
    issues.push(
      `1.2: No enabled Stripe webhook endpoint on ${expectedHost}/api/stripe/webhook. ` +
        `Endpoints found: ${enabled.map((e) => e.url).join(", ") || "none"}. ` +
        `A bare-domain endpoint silently breaks paid publishing (the apex 308 isn't followed).`,
    );
    return;
  }
  const events = onWww.enabled_events;
  const coversAll = events.includes("*") || WEBHOOK_EVENTS.every((ev) => events.includes(ev));
  if (!coversAll) {
    const missing = WEBHOOK_EVENTS.filter((ev) => !events.includes(ev));
    issues.push(`1.4: The www webhook endpoint isn't subscribed to: ${missing.join(", ")}.`);
  }
}

function issuesHtml(issues: string[]): string {
  const rows = issues.map((i) => `<li style="margin:0 0 8px;color:#b3402f">✗ ${i}</li>`).join("");
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <div style="background:#0f2942;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:700;font-size:18px">BoatyardJobs</div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px">
        <h1 style="font-size:18px;margin:0 0 12px">Launch config check found ${issues.length} problem(s)</h1>
        <p style="margin:0 0 12px;color:#334155">These are P0 configuration/data issues that a browser test can't catch — review before advertising the site.</p>
        <ul style="padding-left:18px;margin:0 0 16px">${rows}</ul>
        <p style="margin:0 0 16px"><a href="${siteUrl()}/admin#launch" style="background:#c79a3b;color:#1a1407;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:6px;display:inline-block">Open Launch dashboard</a></p>
      </div>
    </div>`;
}

async function main() {
  const issues: string[] = [];
  await checkMigrations(issues).catch((e) => issues.push(`Migration check failed: ${(e as Error).message}`));
  await checkListingRank(issues).catch((e) => issues.push(`listing_rank check failed: ${(e as Error).message}`));
  await checkStripeWebhook(issues).catch((e) => issues.push(`Stripe webhook check failed: ${(e as Error).message}`));

  if (issues.length === 0) {
    console.log("Config check: all clear ✓ (migrations, Stripe webhook, listing_rank).");
    process.exit(0);
  }

  console.error(`Config check found ${issues.length} problem(s):`);
  for (const i of issues) console.error(`  ✗ ${i}`);

  const to = adminNotifyEmail();
  if (isEmailEnabled() && to) {
    try {
      await sendEmail({
        to,
        subject: `⚠️ BoatyardJobs config check — ${issues.length} P0 problem(s)`,
        html: issuesHtml(issues),
      });
      console.log(`Alert emailed to ${to}.`);
    } catch (e) {
      console.error("Failed to send alert email:", (e as Error).message);
    }
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
