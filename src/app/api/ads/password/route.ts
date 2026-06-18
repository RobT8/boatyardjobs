import { redirect } from "next/navigation";
import { setAdvertiserPassword } from "@/lib/ads";
import { getSessionAdvertiser, hashPassword, verifyPassword } from "@/lib/advertiser-auth";

/** Change password from the profile page. */
export async function POST(req: Request) {
  const advertiser = await getSessionAdvertiser();
  if (!advertiser) redirect("/advertise/login");

  const form = await req.formData();
  const current = String(form.get("current_password") ?? "");
  const next = String(form.get("new_password") ?? "");

  // If the account has a password, the current one must match. (Accounts created
  // via the older flow have none, so allow setting one.)
  if (advertiser!.password_hash && !verifyPassword(current, advertiser!.password_hash)) {
    redirect("/advertise/profile?pwerror=current");
  }
  if (next.length < 8) {
    redirect("/advertise/profile?pwerror=short");
  }

  await setAdvertiserPassword(advertiser!.id, hashPassword(next));
  redirect("/advertise/profile?pwok=1");
}
