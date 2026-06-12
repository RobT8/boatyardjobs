import Link from "next/link";
import { formatSalary, type Job } from "@/lib/jobs";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export default function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const roleLabel = ROLE_CATEGORIES.find((r) => r.slug === job.category)?.label ?? job.category;
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={`block rounded-lg border p-4 transition hover:border-navy-600 hover:shadow-md ${
        job.featured ? "border-brass-400 bg-amber-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-navy-800">{job.title}</h3>
          <p className="text-sm text-slate-600">
            {job.company} · {job.city}, {US_STATES[job.state] ?? job.state}
          </p>
        </div>
        <span className="text-xs text-slate-400">{timeAgo(job.posted_at)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-navy-50 px-2.5 py-0.5 font-medium text-navy-700">
          {roleLabel}
        </span>
        {salary && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
            {salary}
          </span>
        )}
        {job.certifications.slice(0, 3).map((c) => (
          <span key={c} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
            {c}
          </span>
        ))}
        {job.featured ? (
          <span className="ml-auto rounded-full bg-brass-400 px-2.5 py-0.5 font-semibold text-navy-900">
            Featured
          </span>
        ) : null}
      </div>
    </Link>
  );
}
