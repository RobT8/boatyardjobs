import { redirect } from "next/navigation";
import { getJobById, renewDirectJob } from "@/lib/jobs";
import { getEmployerById } from "@/lib/employers";
import { getSessionEmployer } from "@/lib/employer-auth";
import {
  currency,
  featuredJobPostPriceCents,
  getStripe,
  isStripeEnabled,
  jobPostPriceCents,
} from "@/lib/stripe";

/**
 * Renew a direct job listing for another {@link DIRECT_JOB_DAYS}-day run.
 *
 * Reached two ways:
 *  - POST from the employer dashboard (authenticated by session), or
 *  - GET from the "about to expire" email's renew button, authenticated by the
 *    employer's private login_token (`?token=`), so it's one click from inbox
 *    to checkout without a separate sign-in.
 *
 * Sends the buyer to Stripe Checkout; the webhook calls renewDirectJob once
 * payment clears. If Stripe isn't configured, renews immediately (free), mirroring
 * the post-a-job fallback.
 */
async function handle(req: Request, idParam: string) {
  const id = Number(idParam);
  const job = id ? await getJobById(id) : null;
  if (!job || job.source !== "direct" || !job.employer_id) redirect("/employers/dashboard");

  // Authorise: a matching dashboard session, or the employer's login token.
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const session = await getSessionEmployer();
  const employer = await getEmployerById(job!.employer_id!);
  if (!employer) redirect("/employers/dashboard");
  const authorised =
    (session && session.id === employer.id) || (!!token && token === employer.login_token);
  if (!authorised) redirect("/employers/login?next=/employers/dashboard");

  if (!isStripeEnabled()) {
    await renewDirectJob(job!.id, `free-${Date.now()}`);
    redirect("/employers/dashboard?renewed=1");
  }

  const priceCents = job!.featured ? featuredJobPostPriceCents() : jobPostPriceCents();
  const base = url.origin;
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency(),
          unit_amount: priceCents,
          product_data: {
            name: job!.featured
              ? "Featured 30-day job listing renewal — BoatyardJobs"
              : "30-day job listing renewal — BoatyardJobs",
            description: `${job!.title} · ${job!.company}`,
          },
        },
      },
    ],
    success_url: `${base}/employers/dashboard?renewed=1`,
    cancel_url: `${base}/employers/dashboard?renew_canceled=1`,
    customer_email: employer.email,
    metadata: { kind: "renew", jobId: String(job!.id) },
    client_reference_id: String(job!.id),
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
