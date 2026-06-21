import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_CATEGORIES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Marine Trades Certifications Guide",
  description:
    "Which certifications matter for marine technicians, electricians, riggers, yard crew and other boatyard trades — ABYC, NMEA, engine manufacturer programs and more, broken down by role.",
};

/** The main certifying bodies and programmes referenced across the trades. */
const BODIES = [
  {
    name: "ABYC",
    full: "American Boat & Yacht Council",
    body: "The core standards body for US recreational boats. ABYC certifications — Marine Electrical, Marine Systems, Gasoline & Diesel Engines, A/C & Refrigeration, and Marine Corrosion — are the most widely recognised credentials for techs and electricians, and many shops pay for the training and recertification (every five years).",
  },
  {
    name: "NMEA",
    full: "National Marine Electronics Association",
    body: "Certifications for electronics installation: the Marine Electronics Installer (MEI) programme and NMEA 2000 network certification. Expected for anyone wiring chartplotters, radar, autopilots and networked instruments.",
  },
  {
    name: "Engine manufacturers",
    full: "Mercury, Yamaha, Volvo Penta, Yanmar, Suzuki, Honda & more",
    body: "Brand-specific certifications earned through dealer training (e.g. Mercury University, Yamaha Marine University). They're usually required to perform warranty work on that brand, and they travel with you as you move between dealers.",
  },
  {
    name: "EPA Section 609",
    full: "Refrigerant handling",
    body: "A federal certification required to service marine air-conditioning and refrigeration systems that contain refrigerant. Quick to obtain and valuable for systems and HVAC techs.",
  },
  {
    name: "Safety & equipment",
    full: "OSHA, forklift, travel lift, first aid",
    body: "Powered-industrial-truck (forklift) certification, marine travel-lift operation, OSHA 10/30 safety, rigging & signaling, and CPR/first aid. These matter most in the yard and are often provided on the job.",
  },
];

interface RoleCerts {
  /** Credentials commonly expected or that strongly help you get hired. */
  required: string[];
  /** Nice-to-have credentials that set you apart. */
  valued: string[];
  /** Short note on how the trade is typically credentialed. */
  note: string;
}

/** Certification expectations keyed by role-category slug (from the taxonomy). */
const ROLE_CERTS: Record<string, RoleCerts> = {
  "marine-technician": {
    required: ["ABYC Gasoline or Diesel Engines", "Manufacturer engine certification (Mercury, Yamaha, Volvo Penta, Yanmar, Suzuki, Honda…)"],
    valued: ["ABYC Marine Systems", "EPA Section 609 (A/C work)", "Basic ABYC Marine Electrical"],
    note: "Hands-on experience plus at least one brand certification opens most doors; warranty work generally requires the matching manufacturer credential.",
  },
  "marine-electrician": {
    required: ["ABYC Marine Electrical"],
    valued: ["NMEA Marine Electronics Installer (MEI)", "NMEA 2000 network certification", "ABYC Marine Corrosion", "Electronics OEM training (Garmin, Raymarine, Simrad)"],
    note: "ABYC Marine Electrical is the benchmark. Add NMEA credentials if you'll be installing and networking electronics.",
  },
  "yard-staff": {
    required: ["Forklift / powered-industrial-truck certification"],
    valued: ["Marine travel-lift operation", "OSHA 10/30", "Rigging & signaling", "CPR / first aid", "CDL (some roles)"],
    note: "Often an entry point with no marine-specific certification required — most yards train and certify equipment operation on the job.",
  },
  "fiberglass-repair": {
    required: [],
    valued: ["Manufacturer / product training (gelcoat & resin systems)", "ABYC composite & standards awareness", "Respirator fit test & OSHA HazCom"],
    note: "A skills-and-portfolio trade rather than a licensed one. Demonstrated layup, fairing and color-matching ability carries the most weight.",
  },
  rigger: {
    required: [],
    valued: ["Manufacturer rigging / swaging system training", "Splicing certification (cordage makers)", "Working-aloft & fall-protection safety"],
    note: "Credentialed mainly through experience and manufacturer training; there's no single national rigging license for recreational boats.",
  },
  "canvas-upholstery": {
    required: [],
    valued: ["Product training (Sunbrella, Strataglass)", "Industrial sewing / pattern-making coursework"],
    note: "Judged on craftsmanship and a portfolio. Material-specific training helps, but a strong sample of work matters most.",
  },
  "service-writer": {
    required: [],
    valued: ["ABYC standards familiarity", "Manufacturer service-management / warranty training", "Dealership or service-advisor certifications"],
    note: "No technical license required, but technical literacy and warranty-process knowledge make you far more effective and hireable.",
  },
  detailer: {
    required: [],
    valued: ["IDA (International Detailing Association) certification", "Ceramic-coating manufacturer / approved-applicator programs", "Product & chemical safety training"],
    note: "Entry-friendly with no required license; coating-manufacturer certifications let you offer (and warranty) premium services.",
  },
};

function CertList({ title, items, tone }: { title: string; items: string[]; tone: "req" | "val" }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((c) => (
          <li key={c} className="flex gap-2 text-sm text-slate-700">
            <span aria-hidden className={tone === "req" ? "text-emerald-600" : "text-brass-500"}>
              {tone === "req" ? "✓" : "+"}
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CertificationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-800">Marine Trades Certifications Guide</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">
        Certifications signal to employers that you can do the work safely and to standard — and in
        some trades they&apos;re required for warranty work or insurance. Here&apos;s what tends to matter,
        and which credentials map to each role.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-navy-800">The credentials worth knowing</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {BODIES.map((b) => (
            <div key={b.name} className="rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold text-navy-800">{b.name}</h3>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{b.full}</p>
              <p className="mt-2 text-sm text-slate-600">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-navy-800">What you may need, by role</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          A starting point, not a rulebook — requirements vary by employer, region and the boats
          they work on. Use it to decide where to invest your training time.
        </p>
        <div className="mt-6 space-y-5">
          {ROLE_CATEGORIES.map((role) => {
            const certs = ROLE_CERTS[role.slug];
            if (!certs) return null;
            return (
              <div key={role.slug} className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-navy-800">{role.label}</h3>
                  <div className="flex gap-4 text-sm">
                    <Link href={`/jobs/role/${role.slug}`} className="text-navy-600 hover:underline">
                      See jobs →
                    </Link>
                    <Link href={`/salary/${role.slug}`} className="text-navy-600 hover:underline">
                      Pay guide →
                    </Link>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-600">{role.description}</p>
                <CertList title="Commonly required" items={certs.required} tone="req" />
                <CertList title="Valued / stand out" items={certs.valued} tone="val" />
                <p className="mt-3 text-sm italic text-slate-500">{certs.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-12 rounded-lg bg-navy-800 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Put your certifications to work</h2>
        <p className="mx-auto mt-2 max-w-xl text-navy-100">
          Browse open marine trades roles, or set up a free job alert so new listings in your
          specialty come straight to your inbox.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/jobs"
            className="inline-block rounded-md bg-brass-400 px-8 py-3 font-semibold text-navy-900 hover:bg-brass-500"
          >
            Browse jobs
          </Link>
          <Link
            href="/alerts"
            className="inline-block rounded-md border border-white/40 px-8 py-3 font-semibold text-white hover:bg-white/10"
          >
            Set up job alerts
          </Link>
        </div>
      </div>
    </div>
  );
}
