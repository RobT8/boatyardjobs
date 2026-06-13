import { redirect } from "next/navigation";
import { unsubscribeAlert } from "@/lib/alerts";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token) await unsubscribeAlert(token);
  redirect("/alerts?unsubscribed=1");
}
