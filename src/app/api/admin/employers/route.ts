import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { setEnhancedProfile } from "@/lib/employers";

/** Admin toggles an employer's enhanced (detailed) public profile on/off. */
export async function POST(req: Request) {
  if (!(await isAdmin())) redirect("/admin/login");
  const form = await req.formData();
  const id = Number(String(form.get("id") ?? "").trim());
  const enhanced = String(form.get("enhanced") ?? "") === "1";
  if (id) await setEnhancedProfile(id, enhanced);
  redirect("/admin?employer_updated=1#badge-deals");
}
