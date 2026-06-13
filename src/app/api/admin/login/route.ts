import { redirect } from "next/navigation";
import { checkPassword, setAdminCookie } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (checkPassword(password)) {
    await setAdminCookie();
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}
