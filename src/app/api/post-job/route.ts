import { redirect } from "next/navigation";
import { insertJob } from "@/lib/jobs";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

/**
 * Employer submissions go in as 'pending' for review before publishing.
 * Payment (Stripe) gets wired in here once the board is charging.
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

  insertJob({
    title,
    company,
    city,
    state,
    category,
    description,
    apply_email,
    salary_min: Number.isFinite(salaryMin) ? salaryMin : null,
    salary_max: Number.isFinite(salaryMax) ? salaryMax : null,
    salary_unit: get("salary_unit") === "HOUR" ? "HOUR" : "YEAR",
    status: "pending",
  });

  redirect("/post-a-job?submitted=1");
}
