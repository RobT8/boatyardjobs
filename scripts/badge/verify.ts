import { verifyAllDeclared } from "../../src/lib/badge-verify";
import { adminNotifyEmail, isEmailEnabled } from "../../src/lib/email";

/**
 * Badge verification — run weekly. For each page an employer has declared as the
 * home of their "We're Hiring" badge, confirm the badge markup is still there.
 * When a badge goes missing, email the owner once (they decide whether to pull
 * the comped advertising). Transient errors never raise a false alert. Shares
 * its logic with the admin "Check now" button (src/lib/badge-verify.ts).
 */
async function main() {
  if (!(isEmailEnabled() && adminNotifyEmail())) {
    console.warn(
      "Badge alerts NOT configured (need RESEND_API_KEY + LEADS_NOTIFY_EMAIL). " +
        "Statuses will still be recorded for the admin panel, but no email will be sent."
    );
  }

  const sum = await verifyAllDeclared((line) => console.log(line));
  if (sum.checked === 0) {
    console.log("No declared badge placements to verify.");
    return;
  }
  console.log(
    `Badge verification complete: ${sum.present} present, ${sum.missing} missing, ` +
      `${sum.unreachable} unreachable, ${sum.alerted} alert(s) emailed.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
