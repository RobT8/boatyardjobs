import { redirect } from "next/navigation";
import { getAdvertiserByToken } from "@/lib/ads";
import { getStripe, isStripeEnabled } from "@/lib/stripe";

/** Send an advertiser to the Stripe Customer Portal to manage billing/cancel. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const advertiser = token ? await getAdvertiserByToken(token) : null;
  if (!advertiser) redirect("/advertise/login");

  const back = `${new URL(req.url).origin}/advertise/dashboard?token=${token}`;
  if (!isStripeEnabled() || !advertiser.stripe_customer_id) {
    redirect(`/advertise/dashboard?token=${token}&billing=unavailable`);
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: advertiser.stripe_customer_id!,
    return_url: back,
  });
  redirect(session.url);
}
