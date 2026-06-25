import type { Metadata } from "next";
import EmployerAccountStep from "@/components/EmployerAccountStep";
import PostJobWizard from "@/components/PostJobWizard";
import { getSessionEmployer } from "@/lib/employer-auth";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";
import {
  featuredJobPostPriceCents,
  isStripeEnabled,
  jobPostPriceLabel,
  priceLabel,
} from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Post a Job",
  description: "Post a marine trades job to reach candidates in the recreational marine trades.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    submitted?: string;
    error?: string;
    canceled?: string;
    autherror?: string;
    discount_error?: string;
  }>;
}

export default async function PostJobPage({ searchParams }: Props) {
  const { submitted, error, canceled, autherror, discount_error } = await searchParams;
  const employer = await getSessionEmployer();
  const paid = isStripeEnabled();

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-navy-800">Thanks — listing received</h1>
        <p className="mt-4 text-slate-600">
          We review every listing before it goes live (that&apos;s how we keep the board
          scam-free). You&apos;ll get an email when it&apos;s published — usually within one
          business day.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">Post a Job</h1>
      <p className="mt-2 text-slate-600">
        {paid
          ? `Reach candidates across the US marine trades. ${jobPostPriceLabel()} for a 30-day listing — secure checkout via Stripe.`
          : "Free during launch. Every listing is reviewed before publishing."}
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Please check the form — every field except salary is required, and the description needs
          at least a few sentences.
        </p>
      )}
      {discount_error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          That discount code isn&apos;t valid (it may have expired or been used up). Remove it or
          enter a different one.
        </p>
      )}
      {canceled && (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Payment canceled — your listing wasn&apos;t posted. You can review the details and try
          again.
        </p>
      )}

      <div className="mt-8">
        {employer ? (
          <PostJobWizard
            roles={ROLE_CATEGORIES.map((r) => [r.slug, r.label] as [string, string])}
            states={Object.entries(US_STATES)}
            companyName={employer.company}
            applyEmail={employer.email}
            paid={paid}
            basicPriceLabel={jobPostPriceLabel()}
            featuredPriceLabel={priceLabel(featuredJobPostPriceCents())}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <ol className="mb-6 flex gap-2 text-xs font-medium">
              <li className="flex-1 rounded-md bg-navy-800 px-3 py-2 text-center text-white">
                1. Account
              </li>
              {["Job details", "Description", "Review & post"].map((label, i) => (
                <li
                  key={label}
                  className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-center text-slate-400"
                >
                  {i + 2}. {label}
                </li>
              ))}
            </ol>
            <p className="mb-4 text-sm text-slate-600">
              Sign in or create an employer account to post and manage your listings.
            </p>
            <EmployerAccountStep next="/post-a-job" autherror={autherror} />
          </div>
        )}
      </div>
    </div>
  );
}
