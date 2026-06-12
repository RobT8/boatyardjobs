import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobCard from "@/components/JobCard";
import AlertSignupForm from "@/components/AlertSignupForm";
import { listJobs } from "@/lib/jobs";
import { stateFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const match = stateFromSlug(state);
  if (!match) return { title: "Not found" };
  return {
    title: `Marine Trades Jobs in ${match.name}`,
    description: `Open marine technician, electrician, rigger and boatyard jobs in ${match.name}. Updated daily.`,
  };
}

export default async function StateJobsPage({ params }: Props) {
  const { state } = await params;
  const match = stateFromSlug(state);
  if (!match) notFound();

  const { jobs, total } = listJobs({ state: match.code, limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">
        Marine Trades Jobs in {match.name}
      </h1>
      <p className="mt-2 text-slate-600">
        {total} open position{total === 1 ? "" : "s"} at boatyards, marinas and dealerships in{" "}
        {match.name}.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
      {jobs.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No open jobs in {match.name} right now — set an alert below and be first to know.
        </p>
      )}
      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">New {match.name} jobs by email</h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm state={match.code} compact />
        </div>
      </div>
    </div>
  );
}
