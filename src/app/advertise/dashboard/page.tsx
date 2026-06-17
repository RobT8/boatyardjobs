import type { Metadata } from "next";
import Link from "next/link";
import { getAdvertiserAds, getAdvertiserByToken, getChannel, type AdvertiserAd } from "@/lib/ads";

export const metadata: Metadata = {
  title: "Advertiser dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ token?: string; updated?: string; error?: string; billing?: string }>;
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

function AdRow({ row, token }: { row: AdvertiserAd; token: string }) {
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
                ? `Renews ${new Date(ad.current_period_end).toLocaleDateString()}`
                : "Monthly"
              : ad.expires_at
                ? `Ends ${new Date(ad.expires_at).toLocaleDateString()}`
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

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-navy-600">
          Change link
        </summary>
        <form action="/api/ads/link" method="post" className="mt-3 space-y-2">
          <input type="hidden" name="token" value={token} />
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
        <summary className="cursor-pointer text-sm font-medium text-navy-600">
          Replace banner
        </summary>
        <form
          action="/api/ads/creative"
          method="post"
          encType="multipart/form-data"
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="token" value={token} />
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
  const { token, updated, error, billing } = await searchParams;
  const advertiser = token ? await getAdvertiserByToken(token) : null;

  if (!advertiser) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy-800">Link expired or invalid</h1>
        <p className="mt-4 text-slate-600">
          Request a fresh sign-in link from the{" "}
          <Link href="/advertise/login" className="text-navy-600 underline">sign-in page</Link>.
        </p>
      </div>
    );
  }

  const ads = await getAdvertiserAds(advertiser.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">{advertiser.company}</h1>
          <p className="text-sm text-slate-500">Your adverts on BoatyardJobs</p>
        </div>
        <a
          href={`/api/ads/portal?token=${token}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage billing
        </a>
      </div>

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
          Billing management isn&apos;t available for this account yet.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {ads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No adverts yet.{" "}
            <Link href="/advertise" className="text-navy-600 underline">Book your first slot →</Link>
          </p>
        ) : (
          ads.map((row) => <AdRow key={row.ad.id} row={row} token={token!} />)
        )}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Need another slot?{" "}
        <Link href="/advertise" className="text-navy-600 hover:underline">Book more advertising →</Link>
      </p>
    </div>
  );
}
