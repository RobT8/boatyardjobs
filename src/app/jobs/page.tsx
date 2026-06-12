import type { Metadata } from "next";
import JobCard from "@/components/JobCard";
import SearchForm from "@/components/SearchForm";
import AlertSignupForm from "@/components/AlertSignupForm";
import { listJobs } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Browse Marine Trades Jobs",
  description:
    "Search open marine technician, electrician, rigger and boatyard jobs across the United States.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; state?: string; category?: string; page?: string }>;
}

const PAGE_SIZE = 20;

export default async function JobsPage({ searchParams }: Props) {
  const { q, state, category, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const { jobs, total } = listJobs({
    q,
    state,
    category,
    limit: PAGE_SIZE,
    offset: (pageNum - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (state) baseQuery.set("state", state);
  if (category) baseQuery.set("category", category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">Marine Trades Jobs</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <SearchForm q={q} state={state} category={category} />
      </div>

      <p className="mt-6 text-sm text-slate-500">
        {total} job{total === 1 ? "" : "s"} found
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
      {jobs.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p>No jobs match that search yet.</p>
          <p className="mt-2 text-sm">Set up an alert and we&apos;ll email you when one appears:</p>
          <div className="mx-auto mt-4 max-w-md">
            <AlertSignupForm state={state} category={category} compact />
          </div>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
            const qs = new URLSearchParams(baseQuery);
            if (p > 1) qs.set("page", String(p));
            const href = `/jobs${qs.size ? `?${qs}` : ""}`;
            return (
              <a
                key={p}
                href={href}
                className={`rounded-md px-3 py-1.5 ${
                  p === pageNum
                    ? "bg-navy-700 font-semibold text-white"
                    : "bg-slate-100 text-navy-700 hover:bg-navy-100"
                }`}
              >
                {p}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
