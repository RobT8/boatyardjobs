import Link from "next/link";

const SPECS = [
  ["Job-page banner", "728×90 or 970×250 (leaderboard / billboard). Shown responsively."],
  ["Email banner", "600×200 recommended, displayed up to 560px wide."],
  ["File types", "PNG, JPG, WebP or GIF (static preferred)."],
  ["File size", "2MB maximum."],
];

const RULES = [
  "Ads must be relevant to the recreational marine industry or its workforce (e.g. manufacturers, suppliers, tools, training, certification, insurance, recruitment).",
  "No misleading claims, fake “system” or download buttons, or content designed to look like site navigation.",
  "No adult, gambling, political, or discriminatory content, and nothing unlawful.",
  "No competing general job boards or scraped BoatyardJobs listings.",
  "The destination URL must work, be safe, and match the advertised offer.",
  "We review every new or changed banner before it appears, and may decline or remove an ad that doesn't fit. If we decline a paid ad we'll refund the unused portion.",
];

/** Shared advertising-guidelines body, used by the standalone page and the
 * in-wizard popup so they never drift apart. */
export default function GuidelinesContent() {
  return (
    <>
      <p className="text-slate-600">
        We keep the board clean and trustworthy, so ads are reviewed before they go live. Please
        follow these specs and rules — it keeps approval fast.
      </p>

      <h2 className="mt-6 text-lg font-bold text-navy-800">Banner specs</h2>
      <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {SPECS.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 p-4 text-sm">
            <dt className="font-medium text-navy-800">{k}</dt>
            <dd className="col-span-2 text-slate-600">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-6 text-lg font-bold text-navy-800">Content rules</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2 className="mt-6 text-lg font-bold text-navy-800">Billing</h2>
      <p className="mt-3 text-sm text-slate-600">
        Choose monthly (auto-renewing, cancel anytime) or a fixed 1/3/6-month term. Recurring ads
        keep running with the same approved banner until you cancel; changing the banner sends the
        new version for a quick re-review. Manage everything from your{" "}
        <Link href="/advertise/login" className="text-navy-600 underline">advertiser dashboard</Link>.
      </p>
    </>
  );
}
