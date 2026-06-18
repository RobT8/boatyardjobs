import { redirect } from "next/navigation";
import { getAdvertiserByEmail } from "@/lib/ads";
import { setAdvertiserSession, verifyPassword } from "@/lib/advertiser-auth";

function safeNext(next: string): string {
  return next.startsWith("/advertise") ? next : "/advertise";
}

/** Email + password sign-in. */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/advertise/dashboard"));

  const advertiser = await getAdvertiserByEmail(email);
  if (!advertiser || !verifyPassword(password, advertiser.password_hash)) {
    redirect(`/advertise/login?autherror=badlogin&next=${encodeURIComponent(next)}`);
  }

  await setAdvertiserSession(advertiser!.login_token);
  redirect(next);
}
