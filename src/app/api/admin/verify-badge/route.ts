import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { verifyEmployer } from "@/lib/badge-verify";

/** Admin "Check now": verify a single employer's declared badge on demand. */
export async function POST(req: Request) {
  if (!(await isAdmin())) redirect("/admin/login");
  const form = await req.formData();
  const id = Number(String(form.get("id") ?? "").trim());
  if (!id) redirect("/admin#badge-deals");

  const result = await verifyEmployer(id);
  const outcome = result ? result.outcome : "none";
  redirect(`/admin?badge_checked=${outcome}#badge-deals`);
}
