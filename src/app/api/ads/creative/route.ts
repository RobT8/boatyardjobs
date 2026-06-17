import { redirect } from "next/navigation";
import {
  addCreative,
  getAdById,
  getAdvertiserByToken,
  normalizeUrl,
  uploadCreativeImage,
} from "@/lib/ads";

const MAX_BYTES = 600 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Advertiser replaces the banner on one of their ads. The new creative is
 * 'pending' and supersedes the old one, so a changed ad needs re-approval before
 * it shows again — while plain renewals (untouched creative) stay live.
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

  const file = form.get("image");
  if (
    !/^https?:\/\/.+/i.test(targetUrl) ||
    !(file instanceof File) ||
    file.size === 0 ||
    !EXT[file.type] ||
    file.size > MAX_BYTES
  ) {
    redirect(`${dash}&error=1`);
  }

  const f = file as File;
  const bytes = await f.arrayBuffer();
  const { path, url } = await uploadCreativeImage(bytes, f.type, EXT[f.type]);
  await addCreative(adId, path, url, targetUrl);

  redirect(`${dash}&updated=1`);
}
