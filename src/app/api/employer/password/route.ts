import { redirect } from "next/navigation";
import { setEmployerPassword } from "@/lib/employers";
import { getSessionEmployer, hashPassword, verifyPassword } from "@/lib/employer-auth";

/** Change/set password from the employer profile page. */
export async function POST(req: Request) {
  const employer = await getSessionEmployer();
  if (!employer) redirect("/employers/login");

  const form = await req.formData();
  const current = String(form.get("current_password") ?? "");
  const next = String(form.get("new_password") ?? "");

  if (employer!.password_hash && !verifyPassword(current, employer!.password_hash)) {
    redirect("/employers/profile?pwerror=current");
  }
  if (next.length < 8) {
    redirect("/employers/profile?pwerror=short");
  }

  await setEmployerPassword(employer!.id, hashPassword(next));
  redirect("/employers/profile?pwok=1");
}
