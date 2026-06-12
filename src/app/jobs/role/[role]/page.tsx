import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobCard from "@/components/JobCard";
import AlertSignupForm from "@/components/AlertSignupForm";
import { listJobs } from "@/lib/jobs";
import { roleFromSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ role: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) return { title: "Not found" };
  return {
    title: `${match.label} Jobs`,
    description: `${match.description} Open positions across the US, updated daily.`,
  };
}

export default async function RoleJobsPage({ params }: Props) {
  const { role } = await params;
  const match = roleFromSlug(role);
  if (!match) notFound();

  const { jobs, total } = listJobs({ category: match.slug, limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-800">{match.label} Jobs</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{match.description}</p>
      <p className="mt-4 text-sm text-slate-500">
        {total} open position{total === 1 ? "" : "s"}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
      {jobs.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No open {match.label.toLowerCase()} jobs right now — set an alert below.
        </p>
      )}
      <div className="mt-10 rounded-lg bg-navy-800 p-6 text-white">
        <h2 className="font-semibold">New {match.label.toLowerCase()} jobs by email</h2>
        <div className="mt-3 max-w-xl">
          <AlertSignupForm category={match.slug} compact />
        </div>
      </div>
    </div>
  );
}
