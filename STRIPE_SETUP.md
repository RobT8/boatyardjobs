# Stripe & payments setup

BoatyardJobs takes payment for two things, both through the **same** Stripe
account / keys:

1. **Paid job posts** — one-time payment (`/post-a-job`).
2. **Advertising** — the ad manager (`/advertise`): recurring subscriptions
   _and_ fixed-term one-off payments.

Everything flows through one webhook endpoint: **`/api/stripe/webhook`**.

---

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**
(scope: Production, plus Preview if you test there). Redeploy after changes.

| Variable | Required | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes (for payments) | `sk_test_…` / sandbox key while testing, `sk_live_…` for real money. If unset, job posting falls back to a free "pending" flow and ads can't be bought. |
| `STRIPE_WEBHOOK_SECRET` | yes (for payments) | `whsec_…` from the webhook endpoint. Must match the same mode as the secret key. |
| `STRIPE_CURRENCY` | no | Defaults to `usd`. |
| `JOB_POST_PRICE_CENTS` | no | Price of a job post in cents. Defaults to `9900` ($99). |
| `SUPABASE_URL` | yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side full access. |
| `SUPABASE_PUBLISHABLE_KEY` | no | RLS-gated fallback for local/testing. |
| `RESEND_API_KEY` | for emails | Enables alert digests, advertiser magic-link, etc. |
| `ALERTS_FROM_EMAIL` | for emails | e.g. `BoatyardJobs <alerts@boatyardjobs.com>` (verified domain). |
| `SITE_URL` | yes | e.g. `https://www.boatyardjobs.com`. Used in emails and sitemap. |
| `ADMIN_PASSWORD` | yes | Admin dashboard login. |
| `LEADS_NOTIFY_EMAIL` | no | Where "feature your listing" employer leads are emailed. Leads still show in the admin dashboard if unset. |
| `GOOGLE_SITE_VERIFICATION` | no | Google Search Console token. |

> **Ad pricing is in code, not env.** Slots, prices, rotation caps and
> fixed-term discounts live in `src/lib/ads.ts` (`AD_CHANNELS`, `AD_TERMS`).
> Currently: Job pages $99/mo, Email alerts $99/mo, cap 4 each; fixed terms
> 1/3/6 months at 0/5/10% off. Change them there.

---

## Webhook setup (the important bit)

The ad manager's recurring subscriptions need more events than the original
job-post flow. In **Stripe → Webhooks** (find it via the dashboard **Search**
bar → type `webhooks`, or open `https://dashboard.stripe.com/test/webhooks`):

1. Open (or **Add**) the endpoint pointing at:
   `https://www.boatyardjobs.com/api/stripe/webhook` (must be the www host — the apex 308-redirects and Stripe does not follow redirects)
2. Subscribe to **all four** events:
   - `checkout.session.completed` — activates a paid job post **or** ad
   - `invoice.payment_succeeded` — recurring ad renewed → extend
   - `invoice.payment_failed` — recurring ad → pause (stops showing)
   - `customer.subscription.deleted` — recurring ad → canceled
3. Copy the endpoint's **Signing secret** (`whsec_…`) into
   `STRIPE_WEBHOOK_SECRET`.

The secret key, the webhook endpoint, and the signing secret must all be in the
**same mode** (test/sandbox _or_ live). Test and live each have their own
separate webhook lists and keys.

---

## Customer Portal (the "Manage billing" button)

Advertisers manage their subscription (card, invoices, cancel) via Stripe's
hosted **Customer Portal**, which the dashboard's "Manage billing" button opens.
Stripe requires you to **activate it once** or the button can't generate a portal
session:

- Stripe Dashboard → **Settings → Billing → Customer portal** → configure what
  customers can do → **Activate / Save**.
- Test mode and live mode each have their **own** activation — enable both.

Notes:
- An advertiser only gets a "Manage billing" link once they have a Stripe
  customer, i.e. after their first paid advert. Before that the button shows
  "Billing management opens once you've completed your first paid advert."
- If the portal isn't enabled the button shows an error message rather than
  failing silently.

---

## Sandbox / test vs live

- **Sandbox & test mode** use `sk_test_…` keys and a test-mode webhook. Changes
  don't touch your live account.
- Test a purchase with card **`4242 4242 4242 4242`**, any future expiry, any
  CVC/ZIP.
- When ready for real money: switch `STRIPE_SECRET_KEY` to the **live** key,
  create a **live** webhook at the same `/api/stripe/webhook` URL with the same
  four events, and update `STRIPE_WEBHOOK_SECRET` to the live signing secret.

---

## End-to-end test checklist

1. Set test keys + webhook (4 events) in Vercel; redeploy.
2. **Ad:** go to `/advertise`, book a slot (try recurring), pay with the test
   card.
3. After payment you land on `/advertise/success`; the ad appears in
   **Admin → Advertising → Awaiting approval**.
4. Approve it → it shows on a matching job page (rotating) and/or the next alert
   digest email.
5. Check the advertiser dashboard (magic-link from `/advertise/login`) shows
   views/clicks.
6. **Job post:** submit `/post-a-job`, pay with the test card, confirm it
   publishes.
