import { redirect } from "next/navigation";
import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminCookie();
  redirect("/admin/login");
}
