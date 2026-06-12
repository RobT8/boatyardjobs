import Link from "next/link";
import JobCard from "@/components/JobCard";
import SearchForm from "@/components/SearchForm";
import AlertSignupForm from "@/components/AlertSignupForm";
import { countByCategory, countByState, listJobs } from "@/lib/jobs";
import { ROLE_CATEGORIES, stateSlug, US_STATES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { jobs, total } = listJobs({ limit: 8 });
  const states = countByState().slice(0, 10);
  const categories = countByCategory();

  return (
    <>
      <section className="bg-navy-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight">
            Every marine trades job in the US.{" "}
            <span className="text-brass-400">One place.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-navy-100">
            Marine technicians, electricians, riggers and yard crew — {total} open positions at
            boatyards, marinas and dealerships nationwide.
          </p>
          <div className="mt-8 rounded-lg bg-white p-4 shadow-lg">
            <SearchForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold text-navy-800">Latest Jobs</h2>
          <Link href="/jobs" className="text-sm font-semibold text-navy-600 hover:underline">
            View all {total} jobs →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-navy-800">Browse by Trade</h2>
            <ul className="mt-4 space-y-2">
              {ROLE_CATEGORIES.map((r) => {
                const n = categories.find((c) => c.category === r.slug)?.n ?? 0;
                return (
                  <li key={r.slug}>
                    <Link
                      href={`/jobs/role/${r.slug}`}
                      className="flex justify-between rounded-md bg-white px-4 py-2 text-sm shadow-sm hover:bg-navy-50"
                    >
                      <span className="font-medium text-navy-700">{r.label}</span>
                      <span className="text-slate-400">{n} jobs</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-800">Browse by State</h2>
            <ul className="mt-4 space-y-2">
              {states.map(({ state, n }) => (
                <li key={state}>
                  <Link
                    href={`/jobs/state/${stateSlug(state)}`}
                    className="flex justify-between rounded-md bg-white px-4 py-2 text-sm shadow-sm hover:bg-navy-50"
                  >
                    <span className="font-medium text-navy-700">{US_STATES[state] ?? state}</span>
                    <span className="text-slate-400">{n} jobs</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-lg bg-navy-800 p-8 text-white">
          <h2 className="text-2xl font-bold">Never miss a job in your trade</h2>
          <p className="mt-2 text-navy-100">
            Get new listings for your state and specialty by email. Free for candidates, always.
          </p>
          <div className="mt-5 max-w-3xl">
            <AlertSignupForm />
          </div>
        </div>
      </section>
    </>
  );
}
