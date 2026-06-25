import { redirect } from "next/navigation";
import { createAlert } from "@/lib/alerts";
import { confirmEmailHtml, isEmailEnabled, sendEmail } from "@/lib/email";

/** Guard against a single submit fanning out into an unreasonable number of
 *  subscriptions (locations × roles). Well above any realistic hand-pick. */
const MAX_ALERTS = 200;

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/alerts?error=invalid-email");
  }

  // Locations: a whole state (`state` field = code) and/or a specific city
  // (`city` field encoded `ST|City` so the name is disambiguated across states).
  // Each location is its own subscription — picking CA and Miami means "CA jobs
  // OR Miami jobs", not an AND filter — so cities aren't scoped to the states.
  const states = form
    .getAll("state")
    .map((s) => String(s).trim())
    .filter(Boolean);
  const cities = form
    .getAll("city")
    .map((c) => String(c).trim())
    .filter(Boolean)
    .map((c) => {
      const sep = c.indexOf("|");
      return sep === -1
        ? { state: null as string | null, city: c }
        : { state: c.slice(0, sep), city: c.slice(sep + 1) };
    });

  const locations: { state: string | null; city: string | null }[] = [
    ...states.map((s) => ({ state: s, city: null as string | null })),
    ...cities,
  ];
  // No location chosen means "anywhere".
  if (locations.length === 0) locations.push({ state: null, city: null });

  // The full form sends one `category` per ticked role; the compact form sends a
  // single one. No selection (or an empty value) means "all roles".
  const categories = form
    .getAll("category")
    .map((c) => String(c).trim())
    .filter((c) => c !== "");
  const wanted: (string | null)[] = categories.length ? categories : [null];

  // Create one subscription per (location × role); remember a token for a
  // brand-new (still unconfirmed) one so we can send a single confirmation email.
  let pendingToken: string | null = null;
  let created = 0;
  outer: for (const loc of locations) {
    for (const category of wanted) {
      if (created >= MAX_ALERTS) break outer;
      created++;
      const { token, alreadyConfirmed } = await createAlert(email, loc.state, loc.city, category);
      if (!alreadyConfirmed && pendingToken === null) pendingToken = token;
    }
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
