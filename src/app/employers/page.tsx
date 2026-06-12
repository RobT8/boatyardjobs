import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hire Marine Trades Staff",
  description:
    "Reach marine technicians, electricians, riggers and yard crew actively looking for their next role. Post jobs on the marine trades job board.",
};

const PERKS = [
  {
    title: "Candidates you can't reach on Indeed",
    body: "Our audience is marine trades specifically — techs, electricians, riggers and yard crew browsing jobs in their own industry, not commuting past your listing in a generic feed.",
  },
  {
    title: "Real numbers, not promises",
    body: "Your dashboard shows views and apply clicks per listing. You'll always know exactly what your posting is doing.",
  },
  {
    title: "Found by Google automatically",
    body: "Every listing is published with Google for Jobs structured data, so your role appears in the Google jobs box for searches like “marine technician jobs near me.”",
  },
  {
    title: "Certification-aware listings",
    body: "Tag roles with ABYC, Mercury, Yamaha, Volvo Penta and other certifications so the right candidates self-select.",
  },
];

export default function EmployersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">
        Hire the people who keep boats running
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        BoatyardJobs is the dedicated job board for the US recreational marine trades. Post your
        role in minutes — free while we&apos;re in launch.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {PERKS.map((p) => (
          <div key={p.title} className="rounded-lg border border-slate-200 p-5">
            <h2 className="font-semibold text-navy-800">{p.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg bg-navy-800 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Free job postings during launch</h2>
        <p className="mx-auto mt-2 max-w-xl text-navy-100">
          We&apos;re building the candidate audience right now. Early employers post free and keep
          founding-customer pricing when paid plans arrive.
        </p>
        <Link
          href="/post-a-job"
          className="mt-6 inline-block rounded-md bg-brass-400 px-8 py-3 font-semibold text-navy-900 hover:bg-brass-500"
        >
          Post a job — free
        </Link>
      </div>
    </div>
  );
}
