"use client";

import { useMemo, useRef, useState } from "react";
import GuidelinesContent from "@/components/GuidelinesContent";

interface ChannelOpt {
  key: string;
  label: string;
  blurb: string;
  priceCents: number;
  soldOut: boolean;
}
interface TermOpt {
  months: number;
  discountPct: number;
}

interface Props {
  channels: ChannelOpt[];
  terms: TermOpt[];
  states: [string, string][];
  roles: [string, string][];
}

const money = (c: number) => `$${(c / 100).toFixed(0)}`;
const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none";

export default function AdvertiseWizard({ channels, terms, states, roles }: Props) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [periodType, setPeriodType] = useState<"recurring" | "fixed">("recurring");
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const monthly = useMemo(
    () => selected.reduce((s, k) => s + (channels.find((c) => c.key === k)?.priceCents ?? 0), 0),
    [selected, channels]
  );
  const term = terms.find((t) => t.months === months);
  const fixedTotal = Math.round(monthly * months * (1 - (term?.discountPct ?? 0) / 100));
  const jobPagesSelected = selected.includes("job_pages");

  function toggle(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.delete("channels");
      selected.forEach((c) => fd.append("channels", c));
      fd.set("period_type", periodType);
      fd.set("months", String(months));
      const res = await fetch("/api/ads", { method: "POST", body: fd });
      let data: { url?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError(`Server error (${res.status}). Please try again.`);
        setSubmitting(false);
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const priceSummary =
    selected.length === 0
      ? "Select a slot"
      : periodType === "recurring"
        ? `${money(monthly)}/month`
        : `${money(fixedTotal)} for ${months} month${months === 1 ? "" : "s"}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <ol className="mb-6 flex gap-2 text-xs font-medium">
        {["Choose slots", "Your advert", "Review & pay"].map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-md px-3 py-2 text-center ${
              step === i + 1 ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {/* Step 1 — slots + billing (no form fields) */}
      <div className={step === 1 ? "space-y-5" : "hidden"}>
        <div className="space-y-3">
          {channels.map((c) => (
            <label
              key={c.key}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                c.soldOut
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  : `cursor-pointer ${
                      selected.includes(c.key) ? "border-brass-400 bg-amber-50/50" : "border-slate-200"
                    }`
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                disabled={c.soldOut}
                checked={selected.includes(c.key)}
                onChange={() => toggle(c.key)}
              />
              <span className="flex-1">
                <span className="flex justify-between font-semibold text-navy-800">
                  {c.label}
                  <span>{money(c.priceCents)}/mo</span>
                </span>
                <span className="mt-1 block text-sm text-slate-600">{c.blurb}</span>
                {c.soldOut && (
                  <span className="mt-1 block text-xs font-semibold text-red-600">
                    Sold out — all rotation slots are taken right now.
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-navy-800">Billing</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPeriodType("recurring")}
              className={`rounded-md border px-4 py-2 text-sm ${
                periodType === "recurring"
                  ? "border-navy-600 bg-navy-50 font-semibold text-navy-800"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Monthly (recurring)
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("fixed")}
              className={`rounded-md border px-4 py-2 text-sm ${
                periodType === "fixed"
                  ? "border-navy-600 bg-navy-50 font-semibold text-navy-800"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Fixed term
            </button>
          </div>
          {periodType === "fixed" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {terms.map((t) => (
                <button
                  key={t.months}
                  type="button"
                  onClick={() => setMonths(t.months)}
                  className={`rounded-md border px-4 py-2 text-sm ${
                    months === t.months
                      ? "border-navy-600 bg-navy-50 font-semibold text-navy-800"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  {t.months} mo{t.discountPct ? ` · ${t.discountPct}% off` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-lg font-bold text-navy-800">{priceSummary}</span>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => setStep(2)}
            className="rounded-md bg-brass-400 px-6 py-2 font-semibold text-navy-900 hover:bg-brass-500 disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Steps 2 & 3 share one form so the uploaded file persists across them */}
      <form ref={formRef} onSubmit={handleSubmit} className={step >= 2 ? "" : "hidden"}>
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Company</label>
              <input name="company" required={step === 2} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Email</label>
              <input name="email" type="email" required={step === 2} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">
              Destination URL (where clicks go)
            </label>
            <input
              name="target_url"
              type="text"
              inputMode="url"
              required={step === 2}
              placeholder="www.yourcompany.com"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && !/^https?:\/\//i.test(v)) e.target.value = `https://${v}`;
              }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">Banner image</label>
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required={step === 2}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-500">
              PNG, JPG, WebP or GIF, up to 600KB. See our{" "}
              <button
                type="button"
                onClick={() => setShowGuidelines(true)}
                className="text-navy-600 underline"
              >
                advertising guidelines
              </button>
              .
            </p>
          </div>

          {jobPagesSelected && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">
                  Target state <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select name="target_state" className={inputCls} defaultValue="">
                  <option value="">All states</option>
                  {states.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">
                  Target trade <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select name="target_category" className={inputCls} defaultValue="">
                  <option value="">All trades</option>
                  {roles.map(([slug, label]) => (
                    <option key={slug} value={slug}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:underline">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                const form = formRef.current;
                if (!form?.reportValidity()) return;
                // Build a local preview of the uploaded banner + destination link.
                const fileInput = form.elements.namedItem("image") as HTMLInputElement | null;
                const file = fileInput?.files?.[0] ?? null;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
                const linkInput = form.elements.namedItem("target_url") as HTMLInputElement | null;
                let link = (linkInput?.value ?? "").trim();
                if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
                setPreviewLink(link);
                setStep(3);
              }}
              className="rounded-md bg-brass-400 px-6 py-2 font-semibold text-navy-900 hover:bg-brass-500"
            >
              Review →
            </button>
          </div>
        </div>

        <div className={step === 3 ? "space-y-4" : "hidden"}>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <strong>Slots:</strong>{" "}
              {selected.map((k) => channels.find((c) => c.key === k)?.label).join(" + ")}
            </p>
            <p className="mt-1">
              <strong>Billing:</strong>{" "}
              {periodType === "recurring"
                ? `${money(monthly)}/month, auto-renewing`
                : `${money(fixedTotal)} one-off for ${months} month${months === 1 ? "" : "s"}`}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Your banner goes to our team for a quick review before it appears. You can cancel or
              manage billing anytime from your dashboard.
            </p>
          </div>

          {previewUrl && (
            <div>
              <p className="mb-2 text-sm font-medium text-navy-800">Preview — check it works</p>
              <a href={previewLink} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Your banner preview"
                  className="w-full rounded-md border border-slate-200"
                />
              </a>
              <p className="mt-2 text-xs text-slate-500">
                This is how your banner will appear.{" "}
                <a
                  href={previewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy-600 underline"
                >
                  Click to test your link →
                </a>{" "}
                ({previewLink})
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input name="agree" type="checkbox" className="mt-1" required={step === 3} />
            <span>
              I agree to the{" "}
              <button
                type="button"
                onClick={() => setShowGuidelines(true)}
                className="text-navy-600 underline"
              >
                advertising guidelines
              </button>
              .
            </span>
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-500 hover:underline">
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brass-400 px-6 py-3 font-semibold text-navy-900 hover:bg-brass-500 disabled:opacity-50"
            >
              {submitting ? "Redirecting to payment…" : "Pay & submit"}
            </button>
          </div>
        </div>
      </form>

      {showGuidelines && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowGuidelines(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Advertising guidelines"
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-800">Advertising guidelines</h2>
              <button
                type="button"
                onClick={() => setShowGuidelines(false)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <GuidelinesContent />
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => setShowGuidelines(false)}
                className="rounded-md bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
