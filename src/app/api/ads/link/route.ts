import { redirect } from "next/navigation";
import {
  addCreative,
  getAdById,
  getAdvertiserByToken,
  getCurrentCreative,
  normalizeUrl,
} from "@/lib/ads";

/**
 * Advertiser updates only the destination link on an existing ad, keeping the
 * same banner image. Like a banner swap, the change re-enters review before it
 * shows again (the link is the riskiest part of an ad).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "").trim();
  const adId = Number(form.get("ad_id"));
  const targetUrl = normalizeUrl(String(form.get("target_url") ?? ""));
  const dash = `/advertise/dashboard?token=${token}`;

  const advertiser = token ? await getAdvertiserByToken(token) : null;
  if (!advertiser) redirect("/advertise/login");

  const ad = Number.isFinite(adId) ? await getAdById(adId) : null;
  if (!ad || ad.advertiser_id !== advertiser!.id) redirect(`${dash}&error=1`);

  const current = await getCurrentCreative(adId);
  if (!current || !/^https?:\/\/.+/i.test(targetUrl)) redirect(`${dash}&error=1`);

  // New version, same image, new link → pending approval.
  await addCreative(adId, current.image_path, current.image_url, targetUrl);
  redirect(`${dash}&updated=1`);
}
