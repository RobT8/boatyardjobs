export interface RoleCategory {
  slug: string;
  label: string;
  description: string;
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    slug: "marine-technician",
    label: "Marine Technician",
    description:
      "Outboard, inboard, and diesel engine service and repair at dealerships, boatyards, and mobile operations.",
  },
  {
    slug: "marine-electrician",
    label: "Marine Electrician",
    description:
      "Electrical systems, wiring, electronics and navigation equipment installation (ABYC Electrical, NMEA).",
  },
  {
    slug: "yard-staff",
    label: "Yard & Marina Staff",
    description:
      "Travel lift and forklift operators, haul-out crew, yard hands, bottom paint, winterization and launch.",
  },
  {
    slug: "fiberglass-repair",
    label: "Fiberglass & Gelcoat",
    description: "Fiberglass layup, gelcoat repair, structural and cosmetic boat repair.",
  },
  {
    slug: "rigger",
    label: "Rigging",
    description: "Sailboat standing and running rigging, mast stepping, splicing and hardware.",
  },
  {
    slug: "canvas-upholstery",
    label: "Canvas & Upholstery",
    description: "Marine canvas fabrication, enclosures, covers and interior upholstery.",
  },
  {
    slug: "service-writer",
    label: "Service Writer / Manager",
    description: "Customer-facing service scheduling, estimating and shop management at dealers and yards.",
  },
  {
    slug: "detailer",
    label: "Boat Detailing",
    description: "Washing, waxing, compounding, teak care and presentation prep.",
  },
];

export const CERTIFICATIONS = [
  "ABYC Electrical",
  "ABYC Systems",
  "ABYC Diesel",
  "Mercury Certified",
  "Yamaha Certified",
  "Volvo Penta Certified",
  "Suzuki Certified",
  "Honda Marine Certified",
  "Yanmar Certified",
  "NMEA Installer",
] as const;

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export function stateSlug(code: string): string {
  return (US_STATES[code] ?? code).toLowerCase().replace(/\s+/g, "-");
}

/** URL slug for a free-form city name, e.g. "Fort Lauderdale" → "fort-lauderdale".
 *  City pages are scoped under their state, so the slug only needs to be unique
 *  within a state. */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stateFromSlug(slug: string): { code: string; name: string } | null {
  for (const [code, name] of Object.entries(US_STATES)) {
    if (stateSlug(code) === slug.toLowerCase()) return { code, name };
  }
  return null;
}

export function roleFromSlug(slug: string): RoleCategory | null {
  return ROLE_CATEGORIES.find((r) => r.slug === slug.toLowerCase()) ?? null;
}

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code])
);

/**
 * Normalize a free-form state value to a two-letter code.
 * Accepts codes ("FL", "fl") and full names ("Florida"). Returns null if unknown.
 */
export function stateCodeFromRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  const trimmed = region.trim();
  const upper = trimmed.toUpperCase();
  if (upper in US_STATES) return upper;
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] ?? null;
}

/**
 * Keyword → role-category matching, ordered most-specific first so that, e.g.,
 * "marine electronics installer" lands in marine-electrician before the generic
 * "technician" rule can claim it. Used by the aggregation pipeline to bucket
 * upstream listings, which rarely carry our taxonomy.
 */
const CATEGORY_KEYWORDS: { slug: string; patterns: RegExp[] }[] = [
  { slug: "marine-electrician", patterns: [/electric/i, /electronic/i, /\bnmea\b/i, /wiring/i, /chartplotter/i, /navigation/i] },
  { slug: "fiberglass-repair", patterns: [/fiberglass/i, /gelcoat/i, /gel coat/i, /\blayup\b/i, /blister/i, /composite/i] },
  { slug: "rigger", patterns: [/rigg/i, /\bmast\b/i, /\bspar\b/i, /splic/i] },
  { slug: "canvas-upholstery", patterns: [/canvas/i, /upholster/i, /\bsew/i, /cushion/i, /bimini/i, /enclosure/i, /sunbrella/i] },
  { slug: "detailer", patterns: [/detail/i, /\bwax\b/i, /buff/i, /compound/i, /wash[- ]?down/i, /ceramic coat/i, /\bteak\b/i] },
  { slug: "service-writer", patterns: [/service writer/i, /service manager/i, /service advisor/i, /estimat/i, /\bmanager\b/i, /scheduler/i] },
  { slug: "yard-staff", patterns: [/travel ?lift/i, /forklift/i, /haul[- ]?out/i, /\byard\b/i, /\bmarina\b/i, /launch/i, /dry stack/i, /dock hand/i, /bottom paint/i, /winteriz/i] },
  { slug: "marine-technician", patterns: [/technician/i, /\btech\b/i, /mechanic/i, /diesel/i, /outboard/i, /sterndrive/i, /mercruiser/i, /repower/i, /\bengine\b/i, /\bmotor\b/i] },
];

/** Best-guess role category for a listing; falls back to marine-technician. */
export function inferCategory(...text: (string | null | undefined)[]): string {
  const haystack = text.filter(Boolean).join(" ");
  for (const { slug, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.some((re) => re.test(haystack))) return slug;
  }
  return "marine-technician";
}

/** Detect known marine certifications mentioned in free text. */
export function inferCertifications(...text: (string | null | undefined)[]): string[] {
  const haystack = text.filter(Boolean).join(" ").toLowerCase();
  return CERTIFICATIONS.filter((cert) => haystack.includes(cert.toLowerCase()));
}

/**
 * Whether a job TITLE describes a hands-on marine trade (vs. a corporate or
 * office role). Used to keep employer-direct sources on-topic — a boat company's
 * "Total Rewards Manager" or "Sales Advisor" shouldn't land on a trades board.
 * Judge on the title only; descriptions are full of company boilerplate.
 */
const TRADE_ROLE_RE =
  /\b(technician|tech|mechanic|electrician|electrical|rigger|rigging|fiberglass|gelcoat|gel ?coat|laminat\w*|composite|canvas|upholster\w*|detailer|detailing|forklift|travel ?lift|travelift|haul[- ]?out|deck ?hand|dock ?hand|fabricat\w*|welder|welding|installer|outfitter|finisher|painter|machinist|diesel|outboard|sterndrive|mercruiser|repower|boat ?builder|shipwright|service (writer|advisor|manager|technician)|yard (hand|staff|lead|crew)|marina (attendant|staff|tech\w*))\b/i;

export function isTradeRole(title: string | null | undefined): boolean {
  return !!title && TRADE_ROLE_RE.test(title);
}
