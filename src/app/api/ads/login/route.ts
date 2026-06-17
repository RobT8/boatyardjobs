import { redirect } from "next/navigation";
import { getAdvertiserByEmail } from "@/lib/ads";
import { advertiserLoginHtml, isEmailEnabled, sendEmail, siteUrl } from "@/lib/email";

/** Email an advertiser a magic link to their dashboard. */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const advertiser = await getAdvertiserByEmail(email);
    if (advertiser && isEmailEnabled()) {
      const link = `${siteUrl()}/advertise/dashboard?token=${advertiser.login_token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Your BoatyardJobs advertiser dashboard",
          html: advertiserLoginHtml(link),
        });
      } catch (err) {
        console.error("Failed to send advertiser login email:", err);
      }
    }
  }

  // Always report success — don't reveal whether an account exists.
  redirect("/advertise/login?sent=1");
}
