import { redirect } from "next/navigation";
import { getEmployerByEmail } from "@/lib/employers";
import { setEmployerSession, verifyPassword } from "@/lib/employer-auth";

function safeNext(next: string): string {
  return next.startsWith("/post-a-job") || next.startsWith("/employers")
    ? next
    : "/employers/dashboard";
}

/** Email + password sign-in for employers. */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/employers/dashboard"));

  const employer = await getEmployerByEmail(email);
  if (!employer || !verifyPassword(password, employer.password_hash)) {
    redirect(`/employers/login?autherror=badlogin&next=${encodeURIComponent(next)}`);
  }

  await setEmployerSession(employer!.login_token);
  redirect(next);
}
