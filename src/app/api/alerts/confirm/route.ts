import { redirect } from "next/navigation";
import { confirmAlert } from "@/lib/alerts";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = token ? await confirmAlert(token) : false;
  redirect(ok ? "/alerts?confirmed=1" : "/alerts?error=bad-token");
}
