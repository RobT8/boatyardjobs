import { redirect } from "next/navigation";
import { createAlert } from "@/lib/alerts";
import { confirmEmailHtml, isEmailEnabled, sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const state = String(form.get("state") ?? "").trim() || null;

  // The full form sends one `category` per ticked role; the compact form sends a
  // single one. No selection (or an empty value) means "all roles".
  const categories = form
    .getAll("category")
    .map((c) => String(c).trim())
    .filter((c) => c !== "");
  const wanted: (string | null)[] = categories.length ? categories : [null];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/alerts?error=invalid-email");
  }

  // Create one subscription per chosen role; remember a token for a brand-new
  // (still unconfirmed) one so we can send a single confirmation email.
  let pendingToken: string | null = null;
  for (const category of wanted) {
    const { token, alreadyConfirmed } = await createAlert(email, state, category);
    if (!alreadyConfirmed && pendingToken === null) pendingToken = token;
  }

  // Double opt-in: one confirmation link confirms every pending alert for this
  // email (see confirmAlert), so multi-role signups need just one click.
  if (pendingToken && isEmailEnabled()) {
    const base = new URL(req.url).origin;
    try {
      await sendEmail({
        to: email,
        subject: "Confirm your BoatyardJobs alerts",
        html: confirmEmailHtml(
          `${base}/api/alerts/confirm?token=${pendingToken}`,
          `${base}/api/alerts/unsubscribe?token=${pendingToken}`
        ),
      });
    } catch (err) {
      console.error("Failed to send confirmation email:", err);
    }
  }

  redirect(pendingToken ? "/alerts?subscribed=1" : "/alerts?already=1");
}
