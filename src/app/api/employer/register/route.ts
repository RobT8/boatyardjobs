import { redirect } from "next/navigation";
import { createEmployerWithPassword, getEmployerByEmail } from "@/lib/employers";
import { hashPassword, setEmployerSession } from "@/lib/employer-auth";

function safeNext(next: string): string {
  return next.startsWith("/post-a-job") || next.startsWith("/employers") ? next : "/post-a-job";
}

/** Create an employer account and sign them in. */
export async function POST(req: Request) {
  const form = await req.formData();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/post-a-job"));

  if (company.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    redirect(`/employers/login?mode=register&autherror=invalid&next=${encodeURIComponent(next)}`);
  }

  const existing = await getEmployerByEmail(email);
  if (existing) {
    redirect(`/employers/login?autherror=exists&next=${encodeURIComponent(next)}`);
  }

  const employer = await createEmployerWithPassword(company, email, hashPassword(password));
  await setEmployerSession(employer.login_token);
  redirect(next);
}
