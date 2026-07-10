"use client";

import { useState } from "react";

/**
 * Shows the employer's live "We're Hiring" badge plus the copy-paste HTML embed
 * snippet. The snippet is a plain `<a><img></a>` — a real, crawlable backlink to
 * the employer's BoatyardJobs page (good for our SEO) that also shows their live
 * open-roles count on their own careers page (useful to them).
 */
export default function BadgeEmbed({
  employerId,
  siteUrl,
}: {
  employerId: number;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const badgeSrc = `${siteUrl}/api/badge/${employerId}`;
  const target = `${siteUrl}/employers/${employerId}?utm_source=badge&utm_medium=referral&utm_campaign=were-hiring`;
  const alt = "We're hiring — see our marine & boatyard jobs on BoatyardJobs";
  const snippet = `<a href="${target}" target="_blank" rel="noopener">
  <img src="${badgeSrc}" alt="${alt}" width="260" height="72" loading="lazy" />
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
        Paste this on your careers page. It shows your live openings and links back to your jobs on
        BoatyardJobs — which also helps your listings rank in Google.
      </p>

      <div className="mt-3 flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeSrc} alt={alt} width={260} height={72} />
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
