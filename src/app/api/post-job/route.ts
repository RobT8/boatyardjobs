import { redirect } from "next/navigation";
import { insertJob, setJobStripeSession } from "@/lib/jobs";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";
import { currency, getStripe, isStripeEnabled, jobPostPriceCents } from "@/lib/stripe";

/**
 * Employer submission → Stripe Checkout. The job is created 'unpaid' and only
 * published by the Stripe webhook once payment succeeds. If Stripe isn't
 * configured yet, fall back to the old free 'pending' flow so the form still works.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const title = get("title");
  const company = get("company");
  const city = get("city");
  const state = get("state").toUpperCase();
  const category = get("category");
  const description = get("description");
  const apply_email = get("apply_email");

  const valid =
    title.length > 2 &&
    company.length > 1 &&
    city.length > 1 &&
    state in US_STATES &&
    ROLE_CATEGORIES.some((r) => r.slug === category) &&
    description.length > 30 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(apply_email);

  if (!valid) redirect("/post-a-job?error=1");

  const salaryMin = parseInt(get("salary_min"), 10);
  const salaryMax = parseInt(get("salary_max"), 10);

  const input = {
    title,
    company,
    city,
    state,
    category,
    description,
    apply_email,
    salary_min: Number.isFinite(salaryMin) ? salaryMin : null,
    salary_max: Number.isFinite(salaryMax) ? salaryMax : null,
    salary_unit: get("salary_unit") === "HOUR" ? ("HOUR" as const) : ("YEAR" as const),
  };

  // No payments configured → keep the old free, reviewed flow.
  if (!isStripeEnabled()) {
    await insertJob({ ...input, status: "pending" });
    redirect("/post-a-job?submitted=1");
  }

  const { id } = await insertJob({ ...input, status: "unpaid" });
  const base = new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency(),
          unit_amount: jobPostPriceCents(),
          product_data: {
            name: "30-day job listing — BoatyardJobs",
            description: `${title} · ${company} · ${city}, ${state}`,
          },
        },
      },
    ],
    success_url: `${base}/post-a-job/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/post-a-job?canceled=1`,
    customer_email: apply_email,
    metadata: { jobId: String(id) },
    client_reference_id: String(id),
  });

  await setJobStripeSession(id, session.id);
  redirect(session.url!);
}
