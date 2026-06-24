"use client";

import { useEffect, useState } from "react";

/**
 * Share button for a job page. Uses the native share sheet where available
 * (mobile/tablet) and otherwise copies the page URL to the clipboard with a
 * short "Copied!" confirmation. Reads the URL from the browser so it always
 * shares the canonical page the visitor is actually on.
 */
export default function ShareJob({ title, company }: { title: string; company: string }) {
  const [copied, setCopied] = useState(false);

  // Clear the "Copied!" confirmation after a moment.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function share() {
    const url = window.location.href;
    const shareData = { title: `${title} — ${company}`, text: `${title} at ${company}`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled the share sheet, or it failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. insecure context): select-and-prompt fallback.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this job"
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-700 hover:text-white focus:bg-navy-700 focus:text-white focus:outline-none"
    >
      <span aria-hidden>🔗</span>
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
