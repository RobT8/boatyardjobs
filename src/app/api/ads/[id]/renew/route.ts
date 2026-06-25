import { redirect } from "next/navigation";
import {
  AD_CURRENCY,
  getAdById,
  getAdvertiserById,
  getChannel,
  renewFixedAd,
} from "@/lib/ads";
import { getSessionAdvertiser } from "@/lib/advertiser-auth";
import { currency, getStripe, isStripeEnabled } from "@/lib/stripe";

/**
 * Renew a fixed-term advert for another term at the same price.
 *
 * Reached from the advertiser dashboard (POST, session-authed) or the "about to
 * expire" email's renew button (GET with `?token=` = the advertiser's private
 * login token), so it's one click from inbox to checkout. Recurring ads renew
 * through Stripe automatically and are not handled here.
 */
async function handle(req: Request, idParam: string) {
  const id = Number(idParam);
  const ad = id ? await getAdById(id) : null;
  if (!ad || ad.period_type !== "fixed") redirect("/advertise/dashboard");

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const session = await getSessionAdvertiser();
  const advertiser = await getAdvertiserById(ad!.advertiser_id);
  if (!advertiser) redirect("/advertise/dashboard");
  const authorised =
    (session && session.id === advertiser.id) || (!!token && token === advertiser.login_token);
  if (!authorised) redirect("/advertise/login?next=/advertise/dashboard");

  if (!isStripeEnabled()) {
    await renewFixedAd(ad!.id, `free-${Date.now()}`);
    redirect("/advertise/dashboard?renewed=1");
  }

  const base = url.origin;
  const channelLabels = ad!.channels.map((c) => getChannel(c)?.label ?? c).join(" + ");
  const cur = currency() === AD_CURRENCY ? currency() : AD_CURRENCY;
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: cur,
          unit_amount: ad!.price_cents,
          product_data: {
            name: `BoatyardJobs advertising renewal — ${channelLabels}`,
            description: `${ad!.months}-month placement`,
          },
        },
      },
    ],
    customer_email: advertiser.email,
    success_url: `${base}/advertise/dashboard?renewed=1`,
    cancel_url: `${base}/advertise/dashboard?renew_canceled=1`,
    metadata: { kind: "ad_renew", adId: String(ad!.id) },
    client_reference_id: String(ad!.id),
  });

  redirect(checkout.url!);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, id);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, id);
}
