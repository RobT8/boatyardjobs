import {
  adsExpiringWithin,
  expireOverdueFixedAds,
  getChannel,
  markAdExpiryWarned,
} from "../../src/lib/ads";
import { adExpiringHtml, isEmailEnabled, sendEmail, siteUrl } from "../../src/lib/email";

/** Warn this many days ahead of a fixed-term advert's end date. */
const WARN_DAYS = 7;

/**
 * Advertiser expiry warnings — run daily. First flip any lapsed fixed-term ads
 * to 'expired', then email each advertiser whose fixed-term advert ends within
 * WARN_DAYS with a one-click renew link, flagging it so we don't email twice.
 * Recurring ads renew through Stripe automatically and are skipped.
 */
async function main() {
  // Keep dashboard/admin status accurate even when email isn't configured.
  const expired = await expireOverdueFixedAds();
  if (expired) console.log(`Flipped ${expired} lapsed fixed-term ad(s) to expired.`);

  if (!isEmailEnabled()) {
    console.log("RESEND_API_KEY not set; skipping advertiser expiry warnings.");
    return;
  }

  const base = siteUrl();
  const ads = await adsExpiringWithin(WARN_DAYS);
  let sent = 0;

  for (const ad of ads) {
    if (!ad.advertiser?.email) {
      await markAdExpiryWarned(ad.id);
      continue;
    }
    const expires = new Date(ad.expires_at);
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
    const expiresOn = expires.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const channels = ad.channels.map((c) => getChannel(c)?.label ?? c).join(" + ");

    try {
      await sendEmail({
        to: ad.advertiser.email,
        subject: "Your BoatyardJobs advert is about to expire",
        html: adExpiringHtml({
          channels,
          daysLeft,
          expiresOn,
          renewUrl: `${base}/api/ads/${ad.id}/renew?token=${ad.advertiser.login_token}`,
          dashboardUrl: `${base}/advertise/dashboard`,
        }),
      });
      await markAdExpiryWarned(ad.id);
      sent++;
    } catch (err) {
      console.error(`Expiry warning for ad ${ad.id} (${ad.advertiser.email}) failed:`, err);
    }
  }

  console.log(`Advertiser expiry warnings complete: ${sent} email(s) sent across ${ads.length} expiring advert(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
