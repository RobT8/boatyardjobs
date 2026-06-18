import { redirect } from "next/navigation";
import { getSessionAdvertiser } from "@/lib/advertiser-auth";
import { getStripe, isStripeEnabled } from "@/lib/stripe";

/** Send the logged-in advertiser to the Stripe Customer Portal. */
export async function GET(req: Request) {
  const advertiser = await getSessionAdvertiser();
  if (!advertiser) redirect("/advertise/login");

  const back = `${new URL(req.url).origin}/advertise/dashboard`;
  if (!isStripeEnabled() || !advertiser!.stripe_customer_id) {
    redirect("/advertise/dashboard?billing=unavailable");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: advertiser!.stripe_customer_id!,
    return_url: back,
  });
  redirect(session.url);
}
