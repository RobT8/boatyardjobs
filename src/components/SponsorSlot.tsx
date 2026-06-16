import { pickJobPageAd, recordAdEvent } from "@/lib/ads";

/**
 * Renders one rotating sponsor banner for a job page (or nothing if no ad is
 * booked). Records an impression on render; clicks go through /api/ads/[id]/click.
 */
export default async function SponsorSlot({
  state,
  category,
}: {
  state: string;
  category: string;
}) {
  let ad;
  try {
    ad = await pickJobPageAd(state, category);
  } catch {
    return null; // never let an ad failure break the page
  }
  if (!ad) return null;

  try {
    await recordAdEvent(ad.adId, "impression");
  } catch {
    /* best-effort */
  }

  return (
    <div className="mt-10">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">Sponsored</p>
      <a
        href={`/api/ads/${ad.adId}/click`}
        target="_blank"
        rel="noopener sponsored"
        className="mt-1 block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ad.imageUrl}
          alt="Sponsor"
          className="w-full rounded-lg border border-slate-200"
        />
      </a>
    </div>
  );
}
