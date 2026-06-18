"use client";

import { useRef, useState } from "react";

interface Props {
  roles: [string, string][];
  states: [string, string][];
  companyName: string;
  applyEmail: string;
  paid: boolean;
  priceLabel: string;
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none";

export default function PostJobWizard({
  roles,
  states,
  companyName,
  applyEmail,
  paid,
  priceLabel,
}: Props) {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<{
    title: string;
    company: string;
    where: string;
    role: string;
    salary: string;
    description: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function val(name: string): string {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    return el?.value ?? "";
  }

  function buildPreview() {
    const stateName = states.find(([code]) => code === val("state"))?.[1] ?? val("state");
    const roleLabel = roles.find(([slug]) => slug === val("category"))?.[1] ?? val("category");
    const min = val("salary_min");
    const max = val("salary_max");
    const unit = val("salary_unit") === "HOUR" ? "/hr" : "/yr";
    const salary =
      min || max ? `${[min, max].filter(Boolean).join("–")}${unit}` : "Not specified";
    setPreview({
      title: val("title"),
      company: val("company"),
      where: `${val("city")}, ${stateName}`,
      role: roleLabel,
      salary,
      description: val("description"),
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm">
        <span className="text-emerald-800">
          ✓ Signed in as <strong>{companyName}</strong>
        </span>
        <form action="/api/employer/logout" method="post">
          <button className="text-xs font-medium text-slate-500 hover:underline">Log out</button>
        </form>
      </div>

      <ol className="mb-6 flex gap-2 text-xs font-medium">
        <li className="flex-1 rounded-md bg-emerald-100 px-3 py-2 text-center text-emerald-800">
          ✓ Account
        </li>
        {["Job details", "Description", "Review & post"].map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-md px-3 py-2 text-center ${
              step === i + 1 ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {i + 2}. {label}
          </li>
        ))}
      </ol>

      <form ref={formRef} action="/api/post-job" method="post">
        {/* Step 2 — job basics */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Job title</label>
            <input
              name="title"
              required={step >= 1}
              placeholder="e.g. Marine Diesel Technician"
              className={inputCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Company</label>
              <input name="company" required={step >= 1} defaultValue={companyName} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Role category</label>
              <select name="category" required={step >= 1} className={inputCls}>
                {roles.map(([slug, label]) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">City</label>
              <input name="city" required={step >= 1} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">State</label>
              <select name="state" required={step >= 1} className={inputCls} defaultValue="">
                <option value="" disabled>Select…</option>
                {states.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                if (formRef.current?.reportValidity()) setStep(2);
              }}
              className="rounded-md bg-brass-400 px-6 py-2 font-semibold text-navy-900 hover:bg-brass-500"
            >
              Continue →
            </button>
          </div>
        </div>

        {/* Step 3 — description, salary, apply email */}
        <div className={step === 2 ? "space-y-4" : "hidden"}>
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
              required={step >= 2}
              rows={8}
              placeholder="What the role involves, experience and certifications required, pay and benefits…"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Applications email</label>
            <input
              name="apply_email"
              type="email"
              required={step >= 2}
              defaultValue={applyEmail}
              placeholder="hiring@yourcompany.com"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-500">
              Candidates apply straight to this address — we never sit between you and applicants.
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:underline">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!formRef.current?.reportValidity()) return;
                buildPreview();
                setStep(3);
              }}
              className="rounded-md bg-brass-400 px-6 py-2 font-semibold text-navy-900 hover:bg-brass-500"
            >
              Review →
            </button>
          </div>
        </div>

        {/* Step 4 — review & post */}
        <div className={step === 3 ? "space-y-4" : "hidden"}>
          {preview && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-navy-800">{preview.title || "—"}</h3>
              <p className="text-sm text-slate-600">
                {preview.company} · {preview.where}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-navy-50 px-2.5 py-0.5 font-medium text-navy-700">
                  {preview.role}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                  {preview.salary}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{preview.description}</p>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {paid
              ? `Every listing is reviewed before going live. You'll be taken to secure Stripe checkout (${priceLabel}, 30-day listing).`
              : "Free during launch. Every listing is reviewed before publishing."}
          </p>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-500 hover:underline">
              ← Back
            </button>
            <button
              type="submit"
              className="rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 hover:bg-brass-500"
            >
              {paid ? `Continue to payment — ${priceLabel}` : "Submit listing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
