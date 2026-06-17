import type { Metadata } from "next";
import Link from "next/link";
import AdvertiseWizard from "@/components/AdvertiseWizard";
import { AD_CHANNELS, AD_TERMS, channelAvailability } from "@/lib/ads";
import { isStripeEnabled } from "@/lib/stripe";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Advertise on BoatyardJobs",
  description:
    "Put your brand in front of marine-trades professionals. Sponsor job pages or the job-alert emails — self-serve, monthly or fixed term.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ canceled?: string }>;
}

export default async function AdvertisePage({ searchParams }: Props) {
  const { canceled } = await searchParams;
  const availability = await channelAvailability();
  const paid = isStripeEnabled();

  const channels = AD_CHANNELS.map((c) => ({
    key: c.key,
    label: c.label,
    blurb: c.blurb,
    priceCents: c.priceCents,
    soldOut: availability[c.key]?.soldOut ?? false,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass-500">Advertise</p>
      <h1 className="mt-2 text-3xl font-bold text-navy-800">
        Reach the marine trades — and nobody else
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        BoatyardJobs is read by marine technicians, electricians, riggers and yard crew across the
        US. Sponsor the high-intent job pages or the job-alert emails, set it up yourself in a couple
        of minutes, and pay monthly or for a fixed term.
      </p>

      {canceled && (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Checkout canceled — nothing was charged. You can finish your booking below.
        </p>
      )}

      {!paid && (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Online payments aren&apos;t enabled yet. Email{" "}
          <a href="mailto:hello@boatyardjobs.com" className="underline">hello@boatyardjobs.com</a>{" "}
          to book a slot directly.
        </p>
      )}

      <div className="mt-8">
        <AdvertiseWizard
          channels={channels}
          terms={AD_TERMS}
          states={Object.entries(US_STATES)}
          roles={ROLE_CATEGORIES.map((r) => [r.slug, r.label] as [string, string])}
        />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already advertising?{" "}
        <Link href="/advertise/login" className="text-navy-600 hover:underline">
          Sign in to your dashboard
        </Link>{" "}
        ·{" "}
        <Link href="/advertise/guidelines" className="text-navy-600 hover:underline">
          Advertising guidelines
        </Link>
      </p>
    </div>
  );
}
