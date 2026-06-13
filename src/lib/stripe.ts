import Stripe from "stripe";

/**
 * Stripe (server-side). Configure in env:
 *   STRIPE_SECRET_KEY       sk_test_… / sk_live_…
 *   STRIPE_WEBHOOK_SECRET   whsec_… (from the webhook endpoint)
 *   JOB_POST_PRICE_CENTS    optional, default 9900 ($99)
 *   STRIPE_CURRENCY         optional, default "usd"
 */
let stripe: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export function jobPostPriceCents(): number {
  return parseInt(process.env.JOB_POST_PRICE_CENTS ?? "9900", 10) || 9900;
}

export function currency(): string {
  return (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();
}

/** "$99" style label for display in the UI. */
export function jobPostPriceLabel(): string {
  const symbol = currency() === "gbp" ? "£" : currency() === "eur" ? "€" : "$";
  return `${symbol}${(jobPostPriceCents() / 100).toFixed(0)}`;
}
