import { redirect } from "next/navigation";
import { clearEmployerSession } from "@/lib/employer-auth";

export async function POST() {
  await clearEmployerSession();
  redirect("/employers/login");
}
