import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { insertJob } from "@/lib/jobs";
import { upsertEmployer } from "@/lib/employers";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

/**
 * Admin posts a job on a client's behalf (for clients who don't want to use the
 * self-serve flow). Creates a published, direct listing immediately — no Stripe
 * Checkout — so it gets the standard 30-day run. If a client email is given, the
 * job is tied to a (created-if-needed) employer account, so the client can claim
 * it via magic-link login and renew it later.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) redirect("/admin/login");

  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const title = get("title");
  const company = get("company");
  const city = get("city");
  const state = get("state").toUpperCase();
  const category = get("category");
  const description = get("description");
  const apply_email = get("apply_email");
  const clientEmail = get("client_email");

  const valid =
    title.length > 2 &&
    company.length > 1 &&
    city.length > 1 &&
    state in US_STATES &&
    ROLE_CATEGORIES.some((r) => r.slug === category) &&
    description.length > 30 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(apply_email);
  if (!valid) redirect("/admin?job_error=1");

  const salaryMin = parseInt(get("salary_min"), 10);
  const salaryMax = parseInt(get("salary_max"), 10);
  const featured = get("tier") === "featured" ? 1 : 0;

  // Optionally attach to an employer account so the client can manage/renew it.
  let employer_id: number | null = null;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    const employer = await upsertEmployer(company, clientEmail);
    employer_id = employer.id;
  }

  await insertJob({
    title,
    company,
    city,
    state,
    category,
    description,
    apply_email,
    employer_id,
    featured,
    status: "published",
    source: "direct",
    salary_min: Number.isFinite(salaryMin) ? salaryMin : null,
    salary_max: Number.isFinite(salaryMax) ? salaryMax : null,
    salary_unit: get("salary_unit") === "HOUR" ? "HOUR" : "YEAR",
  });

  redirect("/admin?posted=1");
}
