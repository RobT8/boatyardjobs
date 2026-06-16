import { redirect } from "next/navigation";
import { getCurrentCreative, recordAdEvent } from "@/lib/ads";

/** Count a sponsor click, then forward to the advertiser's destination. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const adId = Number(id);
  const creative = Number.isFinite(adId) ? await getCurrentCreative(adId) : null;
  if (!creative) redirect("/");

  try {
    await recordAdEvent(adId, "click");
  } catch (err) {
    console.error("Failed to record ad click:", err);
  }
  redirect(creative.target_url);
}
