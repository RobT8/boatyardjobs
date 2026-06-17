import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { setCreativeApproval } from "@/lib/ads";

/** Admin approves or rejects a pending creative. `id` is the creative id. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await ctx.params;
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  if (action === "approve" || action === "reject") {
    await setCreativeApproval(Number(id), action === "approve" ? "approved" : "rejected");
  }
  redirect("/admin");
}
