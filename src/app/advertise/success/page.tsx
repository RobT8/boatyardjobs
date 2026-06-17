import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Advert booked",
  robots: { index: false, follow: false },
};

export default function AdvertiseSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-navy-800">Payment received — thank you!</h1>
      <p className="mt-4 text-slate-600">
        Your advert is booked. Our team reviews every new banner before it appears (usually within
        one business day) — you&apos;ll see it go live right after that.
      </p>
      <p className="mt-3 text-slate-600">
        We&apos;ve emailed you a private link to your dashboard, where you can track views and clicks,
        swap your banner, or manage billing.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/advertise/login"
          className="rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 hover:bg-brass-500"
        >
          Go to my dashboard
        </Link>
        <Link
          href="/"
          className="rounded-md border border-navy-300 px-6 py-3 font-semibold text-navy-800 hover:bg-navy-50"
        >
          Back to the board
        </Link>
      </div>
    </div>
  );
}
