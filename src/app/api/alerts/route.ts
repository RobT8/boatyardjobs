import { redirect } from "next/navigation";
import { createAlert } from "@/lib/jobs";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const state = String(form.get("state") ?? "").trim() || null;
  const category = String(form.get("category") ?? "").trim() || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/alerts?error=invalid-email");
  }
  createAlert(email, state, category);
  redirect("/alerts?subscribed=1");
}
