import {
  listConfirmedAlerts,
  newJobsForAlert,
  recordAlertSent,
} from "../../src/lib/alerts";
import { formatSalary } from "../../src/lib/jobs";
import { US_STATES } from "../../src/lib/taxonomy";
import {
  digestEmailHtml,
  isEmailEnabled,
  sendEmail,
  siteUrl,
  type DigestJob,
} from "../../src/lib/email";
import { pickEmailAd, recordAdEvent } from "../../src/lib/ads";

/**
 * Alert digest — run on a schedule (after aggregation). For each confirmed
 * subscriber, find published jobs matching their state/category that are newer
 * than their last digest, email them, and record the send.
 */
async function main() {
  if (!isEmailEnabled()) {
    console.log("RESEND_API_KEY not set; skipping digest.");
    return;
  }

  const base = siteUrl();
  const alerts = await listConfirmedAlerts();
  // One sponsor for this run's digests (rotates between runs).
  const sponsorAd = await pickEmailAd();
  const sponsor = sponsorAd
    ? { imageUrl: sponsorAd.imageUrl, clickUrl: `${base}/api/ads/${sponsorAd.adId}/click` }
    : undefined;
  let sent = 0;

  for (const alert of alerts) {
    const jobs = await newJobsForAlert(alert);
    if (jobs.length === 0) continue;

    const digestJobs: DigestJob[] = jobs.map((j) => ({
      title: j.title,
      company: j.company,
      city: j.city,
      stateName: US_STATES[j.state] ?? j.state,
      url: `${base}/jobs/${j.slug}`,
      salary: formatSalary(j),
    }));

    try {
      await sendEmail({
        to: alert.email,
        subject: `${jobs.length} new marine trades job${jobs.length === 1 ? "" : "s"} for you`,
        html: digestEmailHtml(
          digestJobs,
          `${base}/api/alerts/unsubscribe?token=${alert.token}`,
          sponsor
        ),
      });
      await recordAlertSent(alert.id);
      if (sponsorAd) await recordAdEvent(sponsorAd.adId, "impression").catch(() => {});
      sent++;
    } catch (err) {
      console.error(`Digest to ${alert.email} failed:`, err);
    }
  }

  console.log(`Digest complete: ${sent} email(s) sent across ${alerts.length} confirmed alert(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
