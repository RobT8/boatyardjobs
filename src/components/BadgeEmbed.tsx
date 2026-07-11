"use client";

import { useState } from "react";
import { BADGE_STYLES, DEFAULT_BADGE_STYLE, badgeStyle } from "@/lib/badge";

/**
 * Lets an employer pick a "We're Hiring" badge style and copy its embed snippet.
 * The snippet is a plain `<a><img></a>` — a real, crawlable backlink to the
 * employer's BoatyardJobs page (good for our SEO) that also shows their live
 * open-roles count on their own careers page (useful to them). Previews load the
 * live badge endpoint, so the count shown is always current.
 */
export default function BadgeEmbed({
  employerId,
  siteUrl,
}: {
  employerId: number;
  siteUrl: string;
}) {
  const [styleId, setStyleId] = useState(DEFAULT_BADGE_STYLE);
  const [copied, setCopied] = useState(false);

  const style = badgeStyle(styleId);
  const badgeSrc = `${siteUrl}/api/badge/${employerId}?style=${style.id}`;
  const target = `${siteUrl}/employers/${employerId}?utm_source=badge&utm_medium=referral&utm_campaign=were-hiring`;
  const alt = "We're hiring — see our marine & boatyard jobs on BoatyardJobs";
  const snippet = `<a href="${target}" target="_blank" rel="noopener">
  <img src="${badgeSrc}" alt="${alt}" width="${style.w}" height="${style.h}" loading="lazy" />
</a>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500">
        Pick a style, then paste the code on your careers page. It shows your live openings and
        links back to your jobs on BoatyardJobs — which also helps your listings rank in Google.
      </p>

      {/* Style picker — each option previews the real, live badge. */}
      <div role="radiogroup" aria-label="Badge style" className="mt-3 space-y-2">
        {BADGE_STYLES.map((s) => {
          const selected = s.id === styleId;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStyleId(s.id)}
              className={`flex w-full items-center gap-4 rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-navy-600 ring-1 ring-navy-600 bg-navy-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-navy-800">{s.label}</span>
                <span className="text-xs text-slate-500">{s.hint}</span>
              </span>
              <span className="flex shrink-0 items-center justify-center rounded-md bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${siteUrl}/api/badge/${employerId}?style=${s.id}`}
                  alt={`${s.label} badge preview`}
                  width={s.w}
                  height={s.h}
                  style={{ maxWidth: 200, height: "auto" }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-500">Embed code</label>
      <textarea
        readOnly
        rows={3}
        value={snippet}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 focus:border-navy-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-2 rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
      >
        {copied ? "Copied!" : "Copy embed code"}
      </button>
    </div>
  );
}
