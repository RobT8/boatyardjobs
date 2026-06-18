import { redirect } from "next/navigation";
import { getAdvertiserByEmail } from "@/lib/ads";
import { advertiserLoginHtml, isEmailEnabled, sendEmail, siteUrl } from "@/lib/email";

/**
 * "Forgot password" / passwordless fallback: email a one-time sign-in link.
 * The link hits /api/ads/session which sets the session cookie.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const advertiser = await getAdvertiserByEmail(email);
    if (advertiser && isEmailEnabled()) {
      const link = `${siteUrl()}/api/ads/session?token=${advertiser.login_token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Your BoatyardJobs sign-in link",
          html: advertiserLoginHtml(link),
        });
      } catch (err) {
        console.error("Failed to send advertiser sign-in link:", err);
      }
    }
  }

  // Always report success — don't reveal whether an account exists.
  redirect("/advertise/login?sent=1");
}
