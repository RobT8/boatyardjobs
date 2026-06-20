import type { Metadata } from "next";
import JobRow from "@/components/JobRow";
import SearchForm from "@/components/SearchForm";
import AlertSignupForm from "@/components/AlertSignupForm";
import {
  countByCity,
  countByState,
  fairlyRotate,
  getFeaturedJobs,
  listCompanies,
  listJobs,
} from "@/lib/jobs";
import { US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Browse Marine Trades Jobs",
  description:
    "Search open marine technician, electrician, rigger and boatyard jobs across the United States.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    state?: string | string[];
    category?: string | string[];
    company?: string | string[];
    city?: string | string[];
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;
const SORTS: { key: "newest" | "oldest" | "salary"; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "salary", label: "Salary" },
];

/** A repeated query param arrives as string | string[] | undefined. */
const asArray = (v?: string | string[]): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export default async function JobsPage({ searchParams }: Props) {
  const { state, category, company, city, sort: sortParam, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const sort = sortParam === "oldest" || sortParam === "salary" ? sortParam : "newest";

  const states = asArray(state).map((s) => s.toUpperCase());
  const categories = asArray(category);
  const cities = asArray(city);
  const companiesSel = asArray(company);
  const filters = { state: states, category: categories, city: cities, company: companiesSel };

  const [featuredRaw, { jobs, total }, companies, stateCounts, cityCounts] = await Promise.all([
    pageNum === 1 ? getFeaturedJobs(filters) : Promise.resolve([]),
    listJobs({
      ...filters,
      sort,
      excludeFeatured: true,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    }),
    listCompanies(),
    countByState(),
    countByCity(),
  ]);
  const featured = fairlyRotate(featuredRaw);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stateOptions = stateCounts
    .map((s) => ({ code: s.state, name: US_STATES[s.state] ?? s.state }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityOptions = cityCounts.map((c) => ({ city: c.city, state: c.state }));

  // Build a query string carrying every active filter (each repeated per value).
  const filterQs = () => {
    const qs = new URLSearchParams();
    states.forEach((s) => qs.append("state", s));
    categories.forEach((c) => qs.append("category", c));
    cities.forEach((c) => qs.append("city", c));
    companiesSel.forEach((c) => qs.append("company", c));
    return qs;
  };

  const sortHref = (s: string) => {
    const qs = filterQs();
    if (s !== "newest") qs.set("sort", s);
    return `/jobs${qs.toString() ? `?${qs}` : ""}`;
  };

  const pageHref = (p: number) => {
    const qs = filterQs();
    if (sort !== "newest") qs.set("sort", sort);
    if (p > 1) qs.set("page", String(p));
    return `/jobs${qs.toString() ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">Marine Trades Jobs</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <SearchForm
          states={stateOptions}
          cities={cityOptions}
          companies={companies}
          selectedStates={states}
          selectedCategories={categories}
          selectedCities={cities}
          selectedCompanies={companiesSel}
          sort={sort}
        />
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {total} more job{total === 1 ? "" : "s"} found
        </p>
        <div className="flex items-center gap-1 text-xs">
          <span className="mr-1 text-slate-400">Sort:</span>
          {SORTS.map((s) => (
            <a
              key={s.key}
              href={sortHref(s.key)}
              className={`rounded-md px-2.5 py-1 font-medium ${
                sort === s.key
                  ? "bg-navy-700 text-white"
                  : "bg-slate-100 text-navy-700 hover:bg-navy-100"
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
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
            <AlertSignupForm
              state={states.length === 1 ? states[0] : undefined}
              category={categories.length === 1 ? categories[0] : undefined}
              compact
            />
          </div>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
            return (
              <a
                key={p}
                href={pageHref(p)}
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
