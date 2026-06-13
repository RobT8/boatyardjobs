import { redirect } from "next/navigation";
import { createAlert } from "@/lib/alerts";
import { confirmEmailHtml, isEmailEnabled, sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const state = String(form.get("state") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/alerts?error=invalid-email");
  }

  const { token, alreadyConfirmed } = await createAlert(email, state, category);

  // Double opt-in: email a confirmation link before we ever send job digests.
  if (!alreadyConfirmed && isEmailEnabled()) {
    const base = new URL(req.url).origin;
    try {
      await sendEmail({
        to: email,
        subject: "Confirm your BoatyardJobs alert",
        html: confirmEmailHtml(
          `${base}/api/alerts/confirm?token=${token}`,
          `${base}/api/alerts/unsubscribe?token=${token}`
        ),
      });
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
    }
  }

  redirect(alreadyConfirmed ? "/alerts?already=1" : "/alerts?subscribed=1");
}
