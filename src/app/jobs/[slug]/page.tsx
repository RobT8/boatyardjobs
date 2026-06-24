import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AlertSignupForm from "@/components/AlertSignupForm";
import SponsorSlot from "@/components/SponsorSlot";
import BackToJobs from "@/components/BackToJobs";
import ShareJob from "@/components/ShareJob";
import { descriptionParagraphs, formatSalary, getJobBySlug, type Job } from "@/lib/jobs";
import { ROLE_CATEGORIES, stateSlug, US_STATES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Job not found" };
  return {
    title: `${job.title} — ${job.company}, ${job.city} ${job.state}`,
    description: job.description.slice(0, 160),
  };
}

/** schema.org JobPosting markup — required for Google for Jobs inclusion. */
function jobPostingJsonLd(job: Job) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${job.description}</p>`,
    datePosted: job.posted_at.slice(0, 10),
    employmentType: job.employment_type,
    // Google uses identifier to de-duplicate the same posting across boards.
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: String(job.id),
    },
    // True when the candidate applies on our site rather than an external listing.
    directApply: job.source === "direct",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.state,
        addressCountry: "US",
      },
    },
  };
  if (job.expires_at) ld.validThrough = job.expires_at.slice(0, 10);
  if (job.salary_min != null || job.salary_max != null) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salary_min ?? undefined,
        maxValue: job.salary_max ?? undefined,
        unitText: job.salary_unit,
      },
    };
  }
  return ld;
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job || job.status !== "published") notFound();

  const role = ROLE_CATEGORIES.find((r) => r.slug === job.category);
  const salary = formatSalary(job);
  const stateName = US_STATES[job.state] ?? job.state;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(job)) }}
      />
      <div className="mb-4">
        <BackToJobs />
      </div>
      <nav className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/jobs/state/${stateSlug(job.state)}`} className="hover:underline">
          {stateName}
        </Link>
      </nav>

      <h1 className="mt-4 text-3xl font-bold text-navy-800">{job.title}</h1>
      <p className="mt-1 text-lg text-slate-600">
        {job.company} · {job.city}, {stateName}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {role && (
          <Link
            href={`/jobs/role/${role.slug}`}
            className="rounded-full bg-navy-50 px-3 py-1 font-medium text-navy-700 hover:bg-navy-100"
          >
            {role.label}
          </Link>
        )}
        {salary && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            {salary}
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          {job.employment_type === "FULL_TIME" ? "Full time" : job.employment_type}
        </span>
        {job.certifications.map((c) => (
          <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-8 max-w-none space-y-4 leading-relaxed text-slate-700">
        {descriptionParagraphs(job.description).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/jobs/${job.id}/apply`}
            className="inline-block rounded-md bg-brass-400 px-8 py-3 font-semibold text-navy-900 shadow hover:bg-brass-500"
          >
            Apply for this job →
          </a>
          <ShareJob title={job.title} company={job.company} />
        </div>
        {job.source !== "direct" && (
          <p className="mt-2 text-xs text-slate-400">
            You&apos;ll be taken to the employer&apos;s original listing to apply.
          </p>
        )}
      </div>

      {job.source !== "direct" && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brass-400 bg-amber-50/50 p-4">
          <p className="text-sm text-navy-800">
            <span className="font-semibold">Is this your company?</span> Feature this role to put{" "}
            {job.company} at the top of the board, with your logo and analytics.
          </p>
          <Link
            href={`/employers/feature?job=${job.slug}`}
            className="whitespace-nowrap rounded-md bg-brass-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500"
          >
            Feature this listing →
          </Link>
        </div>
      )}

      <SponsorSlot state={job.state} category={job.category} />

      <div className="mt-12 rounded-lg bg-slate-50 p-6">
        <h2 className="font-semibold text-navy-800">
          More {role?.label ?? "marine"} jobs in {stateName}, straight to your inbox
        </h2>
        <div className="mt-3">
          <AlertSignupForm state={job.state} category={job.category} compact />
        </div>
      </div>
    </div>
  );
}
