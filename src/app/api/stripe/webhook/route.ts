import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { publishPaidJob, renewDirectJob } from "@/lib/jobs";
import {
  getAdById,
  setAdStatusBySubscription,
  setAdvertiserStripeCustomer,
  updateAd,
} from "@/lib/ads";

// Needs the raw body + Node crypto for signature verification.
export const runtime = "nodejs";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Current-period end (unix seconds) for a subscription. Recent Stripe API
 * versions moved this from the subscription to its items, so check both.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof top === "number") return top;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? null;
}

/** Activate a paid ad: record the Stripe customer, flip to active, set renewal/expiry. */
async function activateAd(adId: number, session: Stripe.Checkout.Session) {
  const ad = await getAdById(adId);
  if (!ad || ad.status !== "pending_payment") return; // idempotent

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) await setAdvertiserStripeCustomer(ad.advertiser_id, customerId);

  if (ad.period_type === "recurring") {
    const subId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    let currentPeriodEnd: string | null = null;
    if (subId) {
      const sub = await getStripe().subscriptions.retrieve(subId);
      const end = subscriptionPeriodEnd(sub);
      if (end) currentPeriodEnd = new Date(end * 1000).toISOString();
    }
    await updateAd(adId, {
      status: "active",
      stripe_subscription_id: subId ?? null,
      current_period_end: currentPeriodEnd,
    });
  } else {
    await updateAd(adId, {
      status: "active",
      expires_at: addMonths(new Date(), ad.months ?? 1).toISOString(),
    });
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new Response("Webhook not configured", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.kind === "ad") {
          const adId = Number(session.metadata.adId);
          if (adId) await activateAd(adId, session);
        } else if (session.metadata?.kind === "renew") {
          const jobId = Number(session.metadata.jobId);
          if (jobId) await renewDirectJob(jobId, session.id);
        } else {
          const jobId = Number(session.metadata?.jobId);
          if (jobId) await publishPaidJob(jobId);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
        const subId =
          typeof invoice.subscription === "string" ? invoice.subscription : undefined;
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        if (subId) {
          await setAdStatusBySubscription(
            subId,
            "active",
            periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined
          );
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
        const subId =
          typeof invoice.subscription === "string" ? invoice.subscription : undefined;
        if (subId) await setAdStatusBySubscription(subId, "paused");
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await setAdStatusBySubscription(sub.id, "canceled");
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return new Response("Error", { status: 500 }); // let Stripe retry
  }

  return new Response("ok", { status: 200 });
}
