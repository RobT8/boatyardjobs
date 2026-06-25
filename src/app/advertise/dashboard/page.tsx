import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdvertiserAds, getChannel, type AdvertiserAd } from "@/lib/ads";
import { getSessionAdvertiser } from "@/lib/advertiser-auth";

export const metadata: Metadata = {
  title: "Advertiser dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    updated?: string;
    error?: string;
    billing?: string;
    renewed?: string;
    renew_canceled?: string;
  }>;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-800",
  canceled: "bg-slate-100 text-slate-500",
  expired: "bg-slate-100 text-slate-500",
};

function ctr(impr: number, clicks: number): string {
  if (!impr) return "—";
  return `${((clicks / impr) * 100).toFixed(1)}%`;
}

function daysLeftLabel(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
  if (days < 0) return "expired";
  if (days === 0) return "last day";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function AdRow({ row }: { row: AdvertiserAd }) {
  const { ad, creative, stats } = row;
  const channels = ad.channels.map((c) => getChannel(c)?.label ?? c).join(" + ");
  const approval = creative?.approval_status ?? "pending";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-800">{channels}</p>
          <p className="text-sm text-slate-500">
            {ad.period_type === "recurring"
              ? ad.current_period_end
                ? `Renews ${new Date(ad.current_period_end).toLocaleDateString()} (${daysLeftLabel(ad.current_period_end)})`
                : "Monthly"
              : ad.expires_at
                ? `Ends ${new Date(ad.expires_at).toLocaleDateString()} (${daysLeftLabel(ad.expires_at)})`
                : `${ad.months}-month term`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            STATUS_STYLE[ad.status] ?? "bg-slate-100 text-slate-500"
          }`}
        >
          {ad.status}
        </span>
      </div>

      {creative && (
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creative.image_url}
            alt="Your banner"
            className="max-h-32 rounded-md border border-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Banner:{" "}
            <span
              className={
                approval === "approved"
                  ? "font-medium text-emerald-700"
                  : approval === "rejected"
                    ? "font-medium text-red-600"
                    : "font-medium text-amber-700"
              }
            >
              {approval === "approved"
                ? "approved & live"
                : approval === "rejected"
                  ? "rejected — please upload a new one"
                  : "in review"}
            </span>
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-lg font-bold text-navy-800">{stats.impressions}</p>
          <p className="text-xs text-slate-500">Views ({stats.impressions30d} in 30d)</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-lg font-bold text-navy-800">{stats.clicks}</p>
          <p className="text-xs text-slate-500">Clicks ({stats.clicks30d} in 30d)</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-lg font-bold text-navy-800">{ctr(stats.impressions, stats.clicks)}</p>
          <p className="text-xs text-slate-500">CTR</p>
        </div>
      </div>

      {/* Fixed-term ads can be renewed for another term; recurring ones renew
          through Stripe automatically (managed via "Manage billing"). */}
      {ad.period_type === "fixed" && (ad.status === "active" || ad.status === "expired") && (
        <form action={`/api/ads/${ad.id}/renew`} method="post" className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-brass-400 px-3 py-1.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-brass-400 hover:text-navy-900"
          >
            {ad.status === "expired" ? "Renew advert" : `Renew for ${ad.months} more month${ad.months === 1 ? "" : "s"}`}
          </button>
        </form>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-navy-600">Change link</summary>
        <form action="/api/ads/link" method="post" className="mt-3 space-y-2">
          <input type="hidden" name="ad_id" value={ad.id} />
          <input
            name="target_url"
            type="text"
            inputMode="url"
            required
            placeholder="New destination URL (www.example.com)"
            defaultValue={creative?.target_url ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">
            Keeps your current banner; the updated link goes back into review before it shows.
          </p>
          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Update link
          </button>
        </form>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-navy-600">Replace banner</summary>
        <form
          action="/api/ads/creative"
          method="post"
          encType="multipart/form-data"
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="ad_id" value={ad.id} />
          <input
            name="target_url"
            type="text"
            inputMode="url"
            required
            placeholder="Destination URL (www.example.com)"
            defaultValue={creative?.target_url ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">A new banner goes back into review before it shows.</p>
          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Upload new banner
          </button>
        </form>
      </details>
    </div>
  );
}

export default async function AdvertiserDashboardPage({ searchParams }: Props) {
  const { updated, error, billing, renewed, renew_canceled } = await searchParams;
  const advertiser = await getSessionAdvertiser();
  if (!advertiser) redirect("/advertise/login");

  const ads = await getAdvertiserAds(advertiser!.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">{advertiser!.company}</h1>
          <p className="text-sm text-slate-500">Your adverts on BoatyardJobs</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/advertise/profile"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Profile
          </Link>
          <a
            href="/api/ads/portal"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage billing
          </a>
        </div>
      </div>

      {renewed && (
        <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Your advert has been renewed — thank you! It&apos;ll keep running without a gap.
        </p>
      )}
      {renew_canceled && (
        <p className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          Renewal canceled — no payment was taken. You can renew any time below.
        </p>
      )}
      {updated && (
        <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          New banner uploaded — it&apos;s in review and will appear once approved.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Something went wrong with that upload — please check the file and try again.
        </p>
      )}
      {billing === "unavailable" && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Billing management opens once you&apos;ve completed your first paid advert.
        </p>
      )}
      {billing === "error" && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Couldn&apos;t open the billing portal. If this persists, the Stripe Customer Portal may
          need enabling in your Stripe settings.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {ads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No adverts yet.{" "}
            <Link href="/advertise" className="text-navy-600 underline">Book your first slot →</Link>
          </p>
        ) : (
          ads.map((row) => <AdRow key={row.ad.id} row={row} />)
        )}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Need another slot?{" "}
        <Link href="/advertise" className="text-navy-600 hover:underline">Book more advertising →</Link>
      </p>
    </div>
  );
}
