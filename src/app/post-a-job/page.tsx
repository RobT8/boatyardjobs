import type { Metadata } from "next";
import { ROLE_CATEGORIES, US_STATES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Post a Job",
  description: "Post a marine trades job — free during launch.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none";

export default async function PostJobPage({ searchParams }: Props) {
  const { submitted, error } = await searchParams;

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-navy-800">Thanks — listing received</h1>
        <p className="mt-4 text-slate-600">
          We review every listing before it goes live (that&apos;s how we keep the board
          scam-free). You&apos;ll get an email when it&apos;s published — usually within one
          business day.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">Post a Job</h1>
      <p className="mt-2 text-slate-600">
        Free during launch. Every listing is reviewed before publishing.
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Please check the form — every field except salary is required, and the description
          needs at least a few sentences.
        </p>
      )}

      <form action="/api/post-job" method="post" className="mt-8 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy-800">Job title</label>
          <input name="title" required placeholder="e.g. Marine Diesel Technician" className={inputCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Company</label>
            <input name="company" required className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Role category</label>
            <select name="category" required className={inputCls}>
              {ROLE_CATEGORIES.map((r) => (
                <option key={r.slug} value={r.slug}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">City</label>
            <input name="city" required className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">State</label>
            <select name="state" required className={inputCls}>
              {Object.entries(US_STATES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Salary min</label>
            <input name="salary_min" type="number" min="0" placeholder="60000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Salary max</label>
            <input name="salary_max" type="number" min="0" placeholder="85000" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Per</label>
            <select name="salary_unit" className={inputCls}>
              <option value="YEAR">Year</option>
              <option value="HOUR">Hour</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy-800">Description</label>
          <textarea
            name="description"
            required
            rows={8}
            placeholder="What the role involves, experience and certifications required, pay and benefits…"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy-800">
            Applications email
          </label>
          <input
            name="apply_email"
            type="email"
            required
            placeholder="hiring@yourcompany.com"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-500">
            Candidates apply straight to this address — we never sit between you and applicants.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-md bg-brass-400 px-8 py-3 font-semibold text-navy-900 hover:bg-brass-500"
        >
          Submit listing
        </button>
      </form>
    </div>
  );
}
