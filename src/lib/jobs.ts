import { getDb } from "./db";

export interface Job {
  id: number;
  slug: string;
  title: string;
  company: string;
  city: string;
  state: string;
  category: string;
  employment_type: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_unit: "YEAR" | "HOUR";
  certifications: string[];
  source: string;
  source_url: string | null;
  apply_email: string | null;
  featured: number;
  status: string;
  posted_at: string;
  expires_at: string | null;
}

export interface JobFilters {
  q?: string;
  state?: string;
  category?: string;
  company?: string;
  /** Only featured listings. */
  onlyFeatured?: boolean;
  /** Hide featured listings (so they can be shown separately at the top). */
  excludeFeatured?: boolean;
  /** Result ordering for the main list. */
  sort?: "newest" | "oldest" | "salary";
  limit?: number;
  offset?: number;
}

/** Postgres returns jsonb already parsed; coerce defensively to a string[]. */
function normalize(row: Record<string, unknown>): Job {
  const certs = row.certifications;
  return {
    ...(row as unknown as Job),
    certifications: Array.isArray(certs) ? (certs as string[]) : [],
  };
}

export async function listJobs(filters: JobFilters = {}): Promise<{ jobs: Job[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = getDb()
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("status", "published");

  if (filters.state) query = query.eq("state", filters.state.toUpperCase());
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.company) query = query.eq("company", filters.company);
  if (filters.onlyFeatured) query = query.gt("featured", 0);
  if (filters.excludeFeatured) query = query.eq("featured", 0);
  if (filters.q) {
    // Strip characters that would break PostgREST's `or` filter / ilike grammar.
    const term = filters.q.replace(/[%,()*]/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      query = query.or(
        `title.ilike.${like},company.ilike.${like},city.ilike.${like},description.ilike.${like}`
      );
    }
  }

  let ordered = query.order("featured", { ascending: false });
  if (filters.sort === "oldest") {
    ordered = ordered.order("posted_at", { ascending: true });
  } else if (filters.sort === "salary") {
    ordered = ordered
      .order("salary_max", { ascending: false, nullsFirst: false })
      .order("posted_at", { ascending: false });
  } else {
    ordered = ordered.order("posted_at", { ascending: false });
  }

  const { data, count, error } = await ordered.range(offset, offset + limit - 1);

  if (error) throw error;
  return { jobs: (data ?? []).map(normalize), total: count ?? 0 };
}

/** Published featured listings matching the given filters (for carousels and
 * the "featured at top" sections). Ordered by id for a stable rotation base. */
export async function getFeaturedJobs(filters: JobFilters = {}): Promise<Job[]> {
  let query = getDb()
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .gt("featured", 0);
  if (filters.state) query = query.eq("state", filters.state.toUpperCase());
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.company) query = query.eq("company", filters.company);
  const { data, error } = await query.order("id", { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

/**
 * Rotate a list by a time-based offset so each item gets an even, fair share of
 * the top spot over time — independent of how new it is. Stable within each
 * interval, advances by one every `intervalMs`.
 */
export function fairlyRotate<T>(items: T[], intervalMs = 10 * 60 * 1000): T[] {
  if (items.length <= 1) return items;
  const offset = Math.floor(Date.now() / intervalMs) % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

/** Distinct companies with live listings — for the search dropdown. */
export async function listCompanies(): Promise<string[]> {
  const { data, error } = await getDb().from("job_companies").select("company");
  if (error) throw error;
  return (data ?? []).map((r) => r.company as string);
}

export async function getJobBySlug(slug: string): Promise<Job | null> {
  const { data, error } = await getDb().from("jobs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function getJobById(id: number): Promise<Job | null> {
  const { data, error } = await getDb().from("jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function countByState(): Promise<{ state: string; n: number }[]> {
  const { data, error } = await getDb().from("job_counts_by_state").select("*");
  if (error) throw error;
  return (data ?? []) as { state: string; n: number }[];
}

export async function countByCategory(): Promise<{ category: string; n: number }[]> {
  const { data, error } = await getDb().from("job_counts_by_category").select("*");
  if (error) throw error;
  return (data ?? []) as { category: string; n: number }[];
}

/**
 * Published-job counts per (state, category) pair. Powers the programmatic
 * state×role landing pages and the cross-links between them. Backed by the
 * job_counts_by_state_category view.
 */
export async function countByStateAndCategory(): Promise<
  { state: string; category: string; n: number }[]
> {
  const { data, error } = await getDb().from("job_counts_by_state_category").select("*");
  if (error) throw error;
  return (data ?? []) as { state: string; category: string; n: number }[];
}

export async function recordApplyClick(jobId: number): Promise<void> {
  const { error } = await getDb().from("apply_clicks").insert({ job_id: jobId });
  if (error) throw error;
}

export interface NewJobInput {
  title: string;
  company: string;
  city: string;
  state: string;
  category: string;
  employment_type?: string;
  description: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_unit?: "YEAR" | "HOUR";
  certifications?: string[];
  source?: string;
  source_url?: string | null;
  apply_email?: string | null;
  status?: string;
  posted_at?: string;
  employer_id?: number | null;
  featured?: number;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toRow(input: NewJobInput, slug: string) {
  return {
    slug,
    title: input.title,
    company: input.company,
    city: input.city,
    state: input.state.toUpperCase(),
    category: input.category,
    employment_type: input.employment_type ?? "FULL_TIME",
    description: input.description,
    salary_min: input.salary_min ?? null,
    salary_max: input.salary_max ?? null,
    salary_unit: input.salary_unit ?? "YEAR",
    certifications: input.certifications ?? [],
    source: input.source ?? "direct",
    source_url: input.source_url ?? null,
    apply_email: input.apply_email ?? null,
    status: input.status ?? "published",
    posted_at: input.posted_at ?? new Date().toISOString(),
    employer_id: input.employer_id ?? null,
    featured: input.featured ?? 0,
  };
}

async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  let slug = base;
  let i = 2;
  for (;;) {
    const { data } = await db.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function insertJob(input: NewJobInput): Promise<{ id: number; slug: string }> {
  const base = slugify(`${input.title} ${input.company} ${input.city} ${input.state}`);
  const slug = await uniqueSlug(base);
  const { data, error } = await getDb()
    .from("jobs")
    .insert(toRow(input, slug))
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as number, slug };
}

/** Record the Stripe Checkout session that will pay for a job. */
export async function setJobStripeSession(id: number, sessionId: string): Promise<void> {
  const { error } = await getDb().from("jobs").update({ stripe_session_id: sessionId }).eq("id", id);
  if (error) throw error;
}

/**
 * Publish a paid listing. Idempotent: only flips a still-'unpaid' job to
 * published (so repeated webhook deliveries are safe). Returns whether it acted.
 */
export async function publishPaidJob(jobId: number): Promise<boolean> {
  const { data, error } = await getDb()
    .from("jobs")
    .update({ status: "published", posted_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "unpaid")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export type UpsertResult = "created" | "updated" | "unchanged";

/** True if a published job with the same title/company/state already exists —
 * used to stop aggregators (notably Adzuna) creating duplicate rows for the
 * same job listed under multiple URLs. */
async function publishedDuplicateExists(
  input: NewJobInput
): Promise<boolean> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("id")
    .eq("status", "published")
    .eq("title", input.title)
    .eq("company", input.company)
    .eq("state", input.state.toUpperCase())
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Insert or refresh an aggregated listing, keyed on (source, source_url) — the
 * stable identity for a job that lives on someone else's site. Returns whether
 * the row was created, updated (content changed), or left unchanged. A listing
 * that had expired comes back to 'published' if it reappears upstream.
 */
export async function upsertSourcedJob(input: NewJobInput): Promise<UpsertResult> {
  const db = getDb();
  const source = input.source ?? "direct";
  if (!input.source_url) {
    // No stable upstream key — only insert if it isn't already on the board.
    if (await publishedDuplicateExists(input)) return "unchanged";
    await insertJob(input);
    return "created";
  }

  const { data: existing, error } = await db
    .from("jobs")
    .select("*")
    .eq("source", source)
    .eq("source_url", input.source_url)
    .maybeSingle();
  if (error) throw error;

  if (!existing) {
    // New (source, source_url), but skip if the same job already exists (e.g.
    // the aggregator returned it under another URL).
    if (await publishedDuplicateExists(input)) return "unchanged";
    await insertJob(input);
    return "created";
  }

  const ex = normalize(existing);
  const next = {
    title: input.title,
    company: input.company,
    city: input.city,
    state: input.state.toUpperCase(),
    category: input.category,
    employment_type: input.employment_type ?? "FULL_TIME",
    description: input.description,
    salary_min: input.salary_min ?? null,
    salary_max: input.salary_max ?? null,
    salary_unit: input.salary_unit ?? "YEAR",
    certifications: input.certifications ?? [],
  };

  const unchanged =
    ex.status === "published" &&
    ex.title === next.title &&
    ex.company === next.company &&
    ex.city === next.city &&
    ex.state === next.state &&
    ex.category === next.category &&
    ex.employment_type === next.employment_type &&
    ex.description === next.description &&
    ex.salary_min === next.salary_min &&
    ex.salary_max === next.salary_max &&
    ex.salary_unit === next.salary_unit &&
    JSON.stringify(ex.certifications) === JSON.stringify(next.certifications);

  if (unchanged) return "unchanged";

  const { error: updErr } = await db
    .from("jobs")
    .update({ ...next, status: "published" })
    .eq("id", ex.id);
  if (updErr) throw updErr;
  return "updated";
}

/**
 * Mark every published listing from `source` whose source_url is NOT in
 * `seenUrls` as expired — i.e. it vanished upstream since the last run. Returns
 * the number of rows expired. Callers must only invoke this after a *successful*
 * fetch, or a transient upstream outage would wipe the board.
 */
export async function expireMissingFromSource(source: string, seenUrls: string[]): Promise<number> {
  const db = getDb();
  const { data: live, error } = await db
    .from("jobs")
    .select("id, source_url")
    .eq("source", source)
    .eq("status", "published");
  if (error) throw error;

  const seen = new Set(seenUrls);
  const staleIds = (live ?? [])
    .filter((r) => r.source_url && !seen.has(r.source_url))
    .map((r) => r.id as number);
  if (staleIds.length === 0) return 0;

  const { error: updErr } = await db
    .from("jobs")
    .update({ status: "expired" })
    .in("id", staleIds);
  if (updErr) throw updErr;
  return staleIds.length;
}

const SECTION_HEADINGS = [
  "Job Description",
  "Job Summary",
  "Position Summary",
  "Overview",
  "Responsibilities",
  "Key Responsibilities",
  "Essential Duties",
  "Duties",
  "Requirements",
  "Qualifications",
  "Required Qualifications",
  "Preferred Qualifications",
  "Skills",
  "Experience",
  "Education",
  "Benefits",
  "What We Offer",
  "We Offer",
  "Compensation",
  "Pay",
  "Schedule",
  "Hours",
  "About Us",
  "About the Company",
  "Why Join Us",
];

/**
 * Split a job description into readable paragraphs. Sources that already use
 * newlines split on those. Run-on text (no newlines) gets section-heading breaks
 * and is then chunked at sentence boundaries so it isn't one giant paragraph.
 */
export function descriptionParagraphs(text: string): string[] {
  let t = (text ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  // Drop a redundant leading "Job Description" label (often doubled by scrapers).
  t = t.replace(/^((?:job description|job summary)\s+){1,3}/i, "");

  if (!t.includes("\n")) {
    // Break before common section headings (with or without a trailing colon).
    const re = new RegExp(`\\s+(${SECTION_HEADINGS.join("|")})(:|\\b(?=\\s+[A-Z]))`, "gi");
    t = t.replace(re, "\n\n$1$2");
  }

  const blocks = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= 320) {
      out.push(block);
      continue;
    }
    // Chunk a long run-on block into ~3-sentence paragraphs.
    const sentences = block.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [block];
    let buf = "";
    for (const s of sentences) {
      buf += s;
      if (buf.length >= 260) {
        out.push(buf.trim());
        buf = "";
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out.length ? out : [t];
}

export function formatSalary(job: Job): string | null {
  if (job.salary_min == null && job.salary_max == null) return null;
  const fmt = (n: number) =>
    job.salary_unit === "HOUR" ? `$${n}/hr` : `$${Math.round(n / 1000)}k`;
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max)
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  return fmt((job.salary_min ?? job.salary_max)!);
}
