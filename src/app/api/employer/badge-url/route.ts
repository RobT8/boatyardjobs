import { redirect } from "next/navigation";
import { getSessionEmployer } from "@/lib/employer-auth";
import { clearDeclaredPlacement, setDeclaredPlacement } from "@/lib/badge-placements";

/** Normalize the submitted page URL: empty clears it, a bare host gets https://,
 *  anything not a valid http(s) URL is rejected. */
function normalizeUrl(raw: string): string | null | false {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.toString();
  } catch {
    return false;
  }
}

/** Save (or clear) the page where the employer has placed the "We're Hiring"
 *  badge — the URL we verify for the free-advertising deal. */
export async function POST(req: Request) {
  const employer = await getSessionEmployer();
  if (!employer) redirect("/employers/login");

  const form = await req.formData();
  const url = normalizeUrl(String(form.get("badge_url") ?? ""));
  if (url === false) redirect("/employers/profile?badgeerror=url");

  if (url === null) {
    await clearDeclaredPlacement(employer!.id);
    redirect("/employers/profile?badgeok=cleared");
  }

  await setDeclaredPlacement(employer!.id, url);
  redirect("/employers/profile?badgeok=1");
}
