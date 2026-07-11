import { redirect } from "next/navigation";
import { updateEmployerProfile } from "@/lib/employers";
import { getSessionEmployer } from "@/lib/employer-auth";

/**
 * Normalize an optional URL field from the profile form. Empty clears it
 * (returns null). A bare host gets an https:// prefix. Returns `false` if the
 * value isn't a valid http(s) URL, so the caller can reject the submission.
 */
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

/** Save company branding (website + logo URL) from the employer profile page. */
export async function POST(req: Request) {
  const employer = await getSessionEmployer();
  if (!employer) redirect("/employers/login");

  const form = await req.formData();
  const website = normalizeUrl(String(form.get("website") ?? ""));
  const logo_url = normalizeUrl(String(form.get("logo_url") ?? ""));
  const aboutRaw = String(form.get("about") ?? "").trim();
  const about = aboutRaw ? aboutRaw.slice(0, 1000) : null;

  if (website === false || logo_url === false) {
    redirect("/employers/profile?branderror=url");
  }

  await updateEmployerProfile(employer!.id, { website, logo_url, about });
  redirect("/employers/profile?brandok=1");
}
