import Link from "next/link";
import { formatSalary, type Job } from "@/lib/jobs";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Compact single-row listing so many jobs fit per page. */
export default function JobRow({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const role = ROLE_CATEGORIES.find((r) => r.slug === job.category)?.label ?? job.category;
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 transition hover:border-navy-600 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
        job.featured ? "border-brass-400 bg-amber-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold text-navy-800 line-clamp-2 sm:line-clamp-1">{job.title}</p>
        <p className="truncate text-sm text-slate-500">
          {job.company} · {job.city}, {US_STATES[job.state] ?? job.state} · {role}
        </p>
        <span className="mt-0.5 text-xs text-slate-400 sm:hidden">{timeAgo(job.posted_at)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {salary ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {salary}
          </span>
        ) : null}
        {job.featured ? (
          <span className="rounded-full bg-brass-400 px-2.5 py-0.5 text-xs font-semibold text-navy-900">
            Featured
          </span>
        ) : null}
        <span className="hidden text-xs text-slate-400 md:inline">{timeAgo(job.posted_at)}</span>
        <span className="whitespace-nowrap rounded-md border border-navy-600 px-3 py-1.5 text-xs font-semibold text-navy-700">
          View details →
        </span>
      </div>
    </Link>
  );
}
