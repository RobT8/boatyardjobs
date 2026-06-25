import { jobsExpiringWithin, markJobExpiryWarned } from "../../src/lib/jobs";
import { isEmailEnabled, jobExpiringHtml, sendEmail, siteUrl } from "../../src/lib/email";

/** Warn this many days ahead of a listing's expiry. */
const WARN_DAYS = 5;

/**
 * Expiry warnings — run daily (after aggregation). Email each employer whose
 * direct listing expires within WARN_DAYS, with a one-click renew link, and
 * flag the listing as warned so we don't email about it again. Renewal clears
 * the flag, so a renewed-then-re-expiring listing is warned afresh.
 */
async function main() {
  if (!isEmailEnabled()) {
    console.log("RESEND_API_KEY not set; skipping expiry warnings.");
    return;
  }

  const base = siteUrl();
  const jobs = await jobsExpiringWithin(WARN_DAYS);
  let sent = 0;

  for (const job of jobs) {
    if (!job.employer?.email) {
      // No employer to notify (e.g. legacy import) — flag it so we skip it next run.
      await markJobExpiryWarned(job.id);
      continue;
    }
    const expires = new Date(job.expires_at);
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
    const expiresOn = expires.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    try {
      await sendEmail({
        to: job.employer.email,
        subject: `Your BoatyardJobs listing "${job.title}" is about to expire`,
        html: jobExpiringHtml({
          jobTitle: job.title,
          daysLeft,
          expiresOn,
          renewUrl: `${base}/api/jobs/${job.id}/renew?token=${job.employer.login_token}`,
          dashboardUrl: `${base}/employers/dashboard`,
        }),
      });
      await markJobExpiryWarned(job.id);
      sent++;
    } catch (err) {
      console.error(`Expiry warning for job ${job.id} (${job.employer.email}) failed:`, err);
    }
  }

  console.log(`Expiry warnings complete: ${sent} email(s) sent across ${jobs.length} expiring listing(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
