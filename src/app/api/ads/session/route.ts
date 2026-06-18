import { redirect } from "next/navigation";
import { getAdvertiserByToken } from "@/lib/ads";
import { setAdvertiserSession } from "@/lib/advertiser-auth";

/** Magic-link landing: exchange a login_token for a session cookie. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const advertiser = token ? await getAdvertiserByToken(token) : null;
  if (!advertiser) redirect("/advertise/login?autherror=badlink");
  await setAdvertiserSession(token);
  redirect("/advertise/dashboard");
}
