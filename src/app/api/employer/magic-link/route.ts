import { redirect } from "next/navigation";
import { getEmployerByEmail } from "@/lib/employers";
import { employerLoginHtml, isEmailEnabled, sendEmail, siteUrl } from "@/lib/email";

/** "Forgot password": email a one-time sign-in link that sets a session. */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const employer = await getEmployerByEmail(email);
    if (employer && isEmailEnabled()) {
      const link = `${siteUrl()}/api/employer/session?token=${employer.login_token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Your BoatyardJobs employer sign-in link",
          html: employerLoginHtml(link),
        });
      } catch (err) {
        console.error("Failed to send employer sign-in link:", err);
      }
    }
  }

  redirect("/employers/login?sent=1");
}
