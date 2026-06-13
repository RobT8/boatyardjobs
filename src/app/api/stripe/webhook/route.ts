import { getStripe } from "@/lib/stripe";
import { publishPaidJob } from "@/lib/jobs";

// Needs the raw body + Node crypto for signature verification.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new Response("Webhook not configured", { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { jobId?: string } };
    const jobId = Number(session.metadata?.jobId);
    if (jobId) {
      try {
        await publishPaidJob(jobId);
      } catch (err) {
        console.error("Failed to publish paid job:", err);
        return new Response("Error", { status: 500 }); // let Stripe retry
      }
    }
  }

  return new Response("ok", { status: 200 });
}
