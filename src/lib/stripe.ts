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

/** Featured-tier price for a job post. */
export function featuredJobPostPriceCents(): number {
  return parseInt(process.env.JOB_POST_FEATURED_PRICE_CENTS ?? "24900", 10) || 24900;
}

export function currency(): string {
  return (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();
}

function symbol(): string {
  return currency() === "gbp" ? "£" : currency() === "eur" ? "€" : "$";
}

/** "$99" style label from a cents amount. */
export function priceLabel(cents: number): string {
  return `${symbol()}${(cents / 100).toFixed(0)}`;
}

/** "$99" style label for the basic job post. */
export function jobPostPriceLabel(): string {
  return priceLabel(jobPostPriceCents());
}
