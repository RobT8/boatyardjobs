import {
  AD_CURRENCY,
  addCreative,
  createAd,
  fixedTotalCents,
  getChannel,
  getTerm,
  monthlyTotalCents,
  normalizeUrl,
  sanitizeChannels,
  setAdStripeSession,
  uploadCreativeImage,
  upsertAdvertiser,
} from "@/lib/ads";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";
import { currency, getStripe, isStripeEnabled } from "@/lib/stripe";

const MAX_BYTES = 600 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Self-serve ad purchase. Creates the advertiser + ad (pending_payment) + the
 * first creative (pending approval), then hands off to Stripe Checkout. The
 * webhook flips the ad to 'active' once payment succeeds; a human still approves
 * the creative before it renders.
 */
export async function POST(req: Request) {
  if (!isStripeEnabled()) return bad("Payments are not configured yet.");

  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const company = get("company");
  const email = get("email");
  const targetUrl = normalizeUrl(get("target_url"));
  const channels = sanitizeChannels(form.getAll("channels").map(String));
  const periodType = get("period_type") === "fixed" ? "fixed" : "recurring";
  const months = periodType === "fixed" ? parseInt(get("months"), 10) : null;
  const targetState = get("target_state").toUpperCase();
  const targetCategory = get("target_category");

  if (company.length < 2) return bad("Please enter your company name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Please enter a valid email.");
  if (!/^https?:\/\/.+/i.test(targetUrl)) return bad("Enter a valid destination URL (https://…).");
  if (channels.length === 0) return bad("Choose at least one ad slot.");
  if (periodType === "fixed" && !getTerm(months ?? 0)) return bad("Choose a valid term length.");

  const state = targetState && targetState in US_STATES ? targetState : null;
  const category =
    targetCategory && ROLE_CATEGORIES.some((r) => r.slug === targetCategory) ? targetCategory : null;

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return bad("Please upload a banner image.");
  if (!EXT[file.type]) return bad("Banner must be a PNG, JPG, WebP or GIF.");
  if (file.size > MAX_BYTES) return bad("Banner must be 600KB or smaller.");

  const priceCents =
    periodType === "fixed" ? fixedTotalCents(channels, months!) : monthlyTotalCents(channels);
  if (priceCents <= 0) return bad("Could not price that selection.");

  const advertiser = await upsertAdvertiser(company, email);
  const adId = await createAd({
    advertiser_id: advertiser.id,
    channels,
    period_type: periodType,
    months,
    target_state: state,
    target_category: category,
    price_cents: priceCents,
  });

  const bytes = await file.arrayBuffer();
  const { path, url } = await uploadCreativeImage(bytes, file.type, EXT[file.type]);
  await addCreative(adId, path, url, targetUrl);

  const base = new URL(req.url).origin;
  const channelLabels = channels.map((c) => getChannel(c)!.label).join(" + ");
  const cur = currency() === AD_CURRENCY ? currency() : AD_CURRENCY;

  const session =
    periodType === "recurring"
      ? await getStripe().checkout.sessions.create({
          mode: "subscription",
          line_items: channels.map((c) => ({
            quantity: 1,
            price_data: {
              currency: cur,
              unit_amount: getChannel(c)!.priceCents,
              recurring: { interval: "month" as const },
              product_data: { name: `BoatyardJobs advertising — ${getChannel(c)!.label}` },
            },
          })),
          customer_email: email,
          success_url: `${base}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/advertise?canceled=1`,
          metadata: { kind: "ad", adId: String(adId) },
          client_reference_id: String(adId),
        })
      : await getStripe().checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: cur,
                unit_amount: priceCents,
                product_data: {
                  name: `BoatyardJobs advertising — ${channelLabels}`,
                  description: `${months}-month placement`,
                },
              },
            },
          ],
          customer_email: email,
          success_url: `${base}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/advertise?canceled=1`,
          metadata: { kind: "ad", adId: String(adId) },
          client_reference_id: String(adId),
        });

  await setAdStripeSession(adId, session.id);
  return Response.json({ url: session.url });
}
