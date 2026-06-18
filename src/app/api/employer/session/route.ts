import { redirect } from "next/navigation";
import { getEmployerByToken } from "@/lib/employers";
import { setEmployerSession } from "@/lib/employer-auth";

/** Magic-link landing: exchange a login_token for a session cookie. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const employer = token ? await getEmployerByToken(token) : null;
  if (!employer) redirect("/employers/login?autherror=badlink");
  await setEmployerSession(token);
  redirect("/employers/dashboard");
}
