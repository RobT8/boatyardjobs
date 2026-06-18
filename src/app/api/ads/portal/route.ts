import { redirect } from "next/navigation";
import { getSessionAdvertiser } from "@/lib/advertiser-auth";
import { getStripe, isStripeEnabled } from "@/lib/stripe";

/** Send the logged-in advertiser to the Stripe Customer Portal. */
export async function GET(req: Request) {
  const advertiser = await getSessionAdvertiser();
  if (!advertiser) redirect("/advertise/login");

  // No Stripe customer until they've completed a purchase.
  if (!isStripeEnabled() || !advertiser!.stripe_customer_id) {
    redirect("/advertise/dashboard?billing=unavailable");
  }

  const back = `${new URL(req.url).origin}/advertise/dashboard`;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: advertiser!.stripe_customer_id!,
      return_url: back,
    });
    redirect(session.url);
  } catch (err) {
    // redirect() throws internally — let it propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("Stripe billing portal error:", err);
    redirect("/advertise/dashboard?billing=error");
  }
}
