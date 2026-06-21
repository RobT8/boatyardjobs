import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmployer } from "@/lib/employer-auth";
import { listEmployerJobs } from "@/lib/employers";
import { formatSalary } from "@/lib/jobs";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Employer dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROLE_LABEL = Object.fromEntries(ROLE_CATEGORIES.map((r) => [r.slug, r.label]));

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-800",
  unpaid: "bg-amber-50 text-amber-800",
  expired: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Live",
  pending: "In review",
  unpaid: "Awaiting payment",
  expired: "Expired",
};

export default async function EmployerDashboardPage() {
  const employer = await getSessionEmployer();
  if (!employer) redirect("/employers/login");

  const jobs = await listEmployerJobs(employer!.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">{employer!.company}</h1>
          <p className="text-sm text-slate-500">Your job listings</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/employers/profile"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Profile
          </Link>
          <Link
            href="/post-a-job"
            className="rounded-md bg-brass-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brass-500"
          >
            Post a job
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No listings yet.{" "}
            <Link href="/post-a-job" className="text-navy-600 underline">Post your first job →</Link>
          </p>
        ) : (
          jobs.map(({ job, views, clicks }) => (
            <div key={job.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-800">{job.title}</p>
                  <p className="text-sm text-slate-500">
                    {job.company} · {job.city}, {US_STATES[job.state] ?? job.state} ·{" "}
                    {ROLE_LABEL[job.category] ?? job.category}
                    {formatSalary(job) ? ` · ${formatSalary(job)}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLE[job.status] ?? "bg-slate-100 text-slate-500"
                  }`}
                >
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-lg font-bold text-navy-800">{views}</p>
                  <p className="text-xs text-slate-500">Views</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-lg font-bold text-navy-800">{clicks}</p>
                  <p className="text-xs text-slate-500">Apply clicks</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-lg font-bold text-navy-800">
                    {views ? `${((clicks / views) * 100).toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500">Apply rate</p>
                </div>
              </div>

              {job.status === "published" && (
                <Link
                  href={`/jobs/${job.slug}`}
                  className="mt-3 inline-block text-sm text-navy-600 hover:underline"
                >
                  View live listing →
                </Link>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="font-semibold text-navy-800">Want to advertise too?</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          Promote your yard or dealership with a banner across BoatyardJobs — reach marine trades
          candidates beyond your job listings.
        </p>
        <Link
          href="/advertise"
          className="mt-4 inline-block rounded-md bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          Explore advertising →
        </Link>
      </div>
    </div>
  );
}
