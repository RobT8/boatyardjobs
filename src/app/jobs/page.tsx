import type { Metadata } from "next";
import JobRow from "@/components/JobRow";
import SearchForm from "@/components/SearchForm";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByCity, countByState, fairlyRotate, getFeaturedJobs, listCompanies } from "@/lib/jobs";
import { US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Featured Marine Trades Jobs",
  description:
    "Featured marine technician, electrician, rigger and boatyard jobs across the United States.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    state?: string | string[];
    category?: string | string[];
    company?: string | string[];
    city?: string | string[];
  }>;
}

/** A repeated query param arrives as string | string[] | undefined. */
const asArray = (v?: string | string[]): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export default async function JobsPage({ searchParams }: Props) {
  const { state, category, company, city } = await searchParams;

  const states = asArray(state).map((s) => s.toUpperCase());
  const categories = asArray(category);
  const cities = asArray(city);
  const companiesSel = asArray(company);
  const filters = { state: states, category: categories, city: cities, company: companiesSel };

  // Featured-only board: /jobs shows just the featured (paid/promoted) listings,
  // filtered by the search controls.
  const [featuredRaw, companies, stateCounts, cityCounts] = await Promise.all([
    getFeaturedJobs(filters),
    listCompanies(),
    countByState(),
    countByCity(),
  ]);
  const featured = fairlyRotate(featuredRaw);

  const stateOptions = stateCounts
    .map((s) => ({ code: s.state, name: US_STATES[s.state] ?? s.state }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityOptions = cityCounts.map((c) => ({ city: c.city, state: c.state }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">Featured Marine Trades Jobs</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <SearchForm
          states={stateOptions}
          cities={cityOptions}
          companies={companies}
          selectedStates={states}
          selectedCategories={categories}
          selectedCities={cities}
          selectedCompanies={companiesSel}
        />
      </div>

      {featured.length > 0 && (
        <>
          <p className="mt-8 text-sm text-slate-500">
            {featured.length} featured job{featured.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 space-y-3">
            {featured.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </>
      )}

      {featured.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p>No featured jobs match that search yet.</p>
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
    </div>
  );
}
