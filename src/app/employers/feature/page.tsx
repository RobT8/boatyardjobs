import type { Metadata } from "next";
import Link from "next/link";
import { getJobBySlug } from "@/lib/jobs";
import { US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Feature Your Listings",
  description:
    "Your marine trades roles may already be on BoatyardJobs. Feature them with your logo, top placement and performance analytics to reach more candidates.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ job?: string; sent?: string; error?: string }>;
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none";

const BENEFITS = [
  {
    title: "Top of the results",
    body: "Featured roles sit above the rest of the board with a brass highlight, on every state and trade page a candidate browses.",
  },
  {
    title: "Your brand, front and centre",
    body: "Add your logo and company blurb so candidates recognise you — not just another anonymous line in a feed.",
  },
  {
    title: "See what's working",
    body: "Views and apply clicks for every featured role, so you know exactly what your spend is doing.",
  },
];

export default async function FeatureListingPage({ searchParams }: Props) {
  const { job: jobSlug, sent, error } = await searchParams;
  const job = jobSlug ? await getJobBySlug(jobSlug) : null;

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-navy-800">Thanks — we&apos;ll be in touch</h1>
        <p className="mt-4 text-slate-600">
          We&apos;ve got your details and will reach out within one business day to get your
          listings featured. In the meantime, take a look at how your roles appear today.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-block rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 hover:bg-brass-500"
        >
          Browse the board →
        </Link>
      </div>
    );
  }

  const stateName = job ? US_STATES[job.state] ?? job.state : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass-500">For employers</p>
      <h1 className="mt-2 text-3xl font-bold text-navy-800">
        {job ? "Make this listing stand out" : "Feature your marine trades roles"}
      </h1>

      {job ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">This role is already live on BoatyardJobs:</p>
          <p className="mt-1 font-semibold text-navy-800">{job.title}</p>
          <p className="text-sm text-slate-600">
            {job.company} · {job.city}, {stateName}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Featuring it puts <strong>{job.company}</strong> at the top of the board with your logo
            and full analytics. Tell us where to send the details.
          </p>
        </div>
      ) : (
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          Boatyards, marinas and dealerships across the US are already listed here. Feature your
          roles to put them at the top of the board, branded, in front of candidates who work in
          the marine trades — and nowhere else.
        </p>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-semibold text-navy-800">{b.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{b.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-navy-800">
          {job ? "Feature this listing" : "Tell us about your roles"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          No payment now — we&apos;ll confirm the details and pricing with you first.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Please add your company name and a valid email so we can reach you.
          </p>
        )}

        <form action="/api/employer-leads" method="post" className="mt-5 space-y-4">
          <input type="hidden" name="interest" value={job ? "claim" : "feature"} />
          {job && (
            <>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="job_slug" value={job.slug} />
              <input type="hidden" name="job_title" value={`${job.title} — ${job.company}`} />
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Company</label>
              <input name="company" required defaultValue={job?.company ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Your name</label>
              <input name="contact_name" className={inputCls} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Email</label>
              <input name="email" type="email" required placeholder="you@company.com" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input name="phone" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">
              Anything else? <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              name="message"
              rows={3}
              placeholder="How many roles are you hiring for, and where?"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-brass-400 px-8 py-3 font-semibold text-navy-900 hover:bg-brass-500"
          >
            {job ? "Feature this role" : "Get featured"}
          </button>
        </form>
      </div>
    </div>
  );
}
