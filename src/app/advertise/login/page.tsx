import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advertiser sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ sent?: string }>;
}

export default async function AdvertiseLoginPage({ searchParams }: Props) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy-800">Check your email</h1>
        <p className="mt-4 text-slate-600">
          If that address has an advertiser account, we&apos;ve sent a private link to your
          dashboard. It can take a minute to arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-800">Advertiser sign in</h1>
      <p className="mt-3 text-sm text-slate-600">
        Enter the email you used to book your advert and we&apos;ll send a private link to your
        dashboard.
      </p>
      <form action="/api/ads/login" method="post" className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-brass-400 px-6 py-2.5 font-semibold text-navy-900 hover:bg-brass-500"
        >
          Email me my dashboard link
        </button>
      </form>
    </div>
  );
}
