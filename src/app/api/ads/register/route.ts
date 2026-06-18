import { redirect } from "next/navigation";
import { createAdvertiserWithPassword, getAdvertiserByEmail } from "@/lib/ads";
import { hashPassword, setAdvertiserSession } from "@/lib/advertiser-auth";

function safeNext(next: string): string {
  return next.startsWith("/advertise") ? next : "/advertise";
}

/** Create an advertiser account and sign them in. */
export async function POST(req: Request) {
  const form = await req.formData();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/advertise"));

  if (
    company.length < 2 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    password.length < 8
  ) {
    redirect(`/advertise/login?mode=register&autherror=invalid&next=${encodeURIComponent(next)}`);
  }

  const existing = await getAdvertiserByEmail(email);
  if (existing) {
    redirect(`/advertise/login?autherror=exists&next=${encodeURIComponent(next)}`);
  }

  const advertiser = await createAdvertiserWithPassword(company, email, hashPassword(password));
  await setAdvertiserSession(advertiser.login_token);
  redirect(next);
}
