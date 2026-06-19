import type { Metadata } from "next";
import JobRow from "@/components/JobRow";
import SearchForm from "@/components/SearchForm";
import AlertSignupForm from "@/components/AlertSignupForm";
import { fairlyRotate, getFeaturedJobs, listCompanies, listJobs } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Browse Marine Trades Jobs",
  description:
    "Search open marine technician, electrician, rigger and boatyard jobs across the United States.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ state?: string; category?: string; company?: string; page?: string }>;
}

const PAGE_SIZE = 25;

export default async function JobsPage({ searchParams }: Props) {
  const { state, category, company, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const filters = { state, category, company };

  const [featuredRaw, { jobs, total }, companies] = await Promise.all([
    pageNum === 1 ? getFeaturedJobs(filters) : Promise.resolve([]),
    listJobs({
      ...filters,
      excludeFeatured: true,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    }),
    listCompanies(),
  ]);
  const featured = fairlyRotate(featuredRaw);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (state) baseQuery.set("state", state);
  if (category) baseQuery.set("category", category);
  if (company) baseQuery.set("company", company);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">Marine Trades Jobs</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <SearchForm state={state} category={category} company={company} companies={companies} />
      </div>

      {featured.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brass-500">Featured</h2>
          <div className="mt-3 space-y-3">
            {featured.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-slate-500">
        {total} more job{total === 1 ? "" : "s"} found
      </p>
      <div className="mt-3 space-y-3">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>

      {jobs.length === 0 && featured.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p>No jobs match that search yet.</p>
          <p className="mt-2 text-sm">Set up an alert and we&apos;ll email you when one appears:</p>
          <div className="mx-auto mt-4 max-w-md">
            <AlertSignupForm state={state} category={category} compact />
          </div>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
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
