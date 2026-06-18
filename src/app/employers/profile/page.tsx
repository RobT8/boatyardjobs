import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmployer } from "@/lib/employer-auth";
import { listEmployerJobs } from "@/lib/employers";

export const metadata: Metadata = {
  title: "Employer profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ pwok?: string; pwerror?: string }>;
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-none";

export default async function EmployerProfilePage({ searchParams }: Props) {
  const { pwok, pwerror } = await searchParams;
  const employer = await getSessionEmployer();
  if (!employer) redirect("/employers/login");

  const jobs = await listEmployerJobs(employer!.id);
  const liveCount = jobs.filter((j) => j.job.status === "published").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-800">My profile</h1>
        <form action="/api/employer/logout" method="post">
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Log out
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-800">Account details</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Company</dt>
            <dd className="font-medium text-navy-800">{employer!.company}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-navy-800">{employer!.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Member since</dt>
            <dd className="text-slate-700">{new Date(employer!.created_at).toLocaleDateString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Listings</dt>
            <dd className="text-slate-700">{jobs.length} total · {liveCount} live</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-800">
          {employer!.password_hash ? "Change password" : "Set a password"}
        </h2>
        {pwok && (
          <p className="mt-3 rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            Password updated.
          </p>
        )}
        {pwerror === "current" && (
          <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            Your current password is incorrect.
          </p>
        )}
        {pwerror === "short" && (
          <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            New password must be at least 8 characters.
          </p>
        )}
        <form action="/api/employer/password" method="post" className="mt-3 space-y-3">
          {employer!.password_hash && (
            <input
              name="current_password"
              type="password"
              required
              placeholder="Current password"
              className={inputCls}
            />
          )}
          <input
            name="new_password"
            type="password"
            required
            minLength={8}
            placeholder="New password (8+ characters)"
            className={inputCls}
          />
          <button
            type="submit"
            className="rounded-md bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Save password
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/employers/dashboard" className="text-navy-600 hover:underline">My listings</Link>
        {" · "}
        <Link href="/post-a-job" className="text-navy-600 hover:underline">Post a job</Link>
      </p>
    </div>
  );
}
