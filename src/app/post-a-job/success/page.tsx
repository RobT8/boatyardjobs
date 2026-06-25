import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Listing received" };

interface Props {
  searchParams: Promise<{ free?: string }>;
}

export default async function PostJobSuccessPage({ searchParams }: Props) {
  const { free } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-navy-800">
        {free ? "Listing published — thank you!" : "Payment received — thank you!"}
      </h1>
      <p className="mt-4 text-slate-600">
        {free
          ? "Your discounted listing is live on the board now and will run for 30 days."
          : "Your listing is being published and will appear on the board within a minute or two. A receipt has been emailed to you by Stripe."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/jobs"
          className="rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 hover:bg-brass-500"
        >
          View the board
        </Link>
        <Link
          href="/post-a-job"
          className="rounded-md border border-slate-300 px-6 py-3 font-semibold text-navy-700 hover:bg-slate-50"
        >
          Post another
        </Link>
      </div>
    </div>
  );
}
