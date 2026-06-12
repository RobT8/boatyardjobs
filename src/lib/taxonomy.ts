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

export function stateFromSlug(slug: string): { code: string; name: string } | null {
  for (const [code, name] of Object.entries(US_STATES)) {
    if (stateSlug(code) === slug.toLowerCase()) return { code, name };
  }
  return null;
}

export function roleFromSlug(slug: string): RoleCategory | null {
  return ROLE_CATEGORIES.find((r) => r.slug === slug.toLowerCase()) ?? null;
}
