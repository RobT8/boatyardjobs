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

  const { data, count, error } = await query
    .order("featured", { ascending: false })
    .order("posted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { jobs: (data ?? []).map(normalize), total: count ?? 0 };
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
    // No stable upstream key — fall back to a plain insert.
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

export function formatSalary(job: Job): string | null {
  if (job.salary_min == null && job.salary_max == null) return null;
  const fmt = (n: number) =>
    job.salary_unit === "HOUR" ? `$${n}/hr` : `$${Math.round(n / 1000)}k`;
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max)
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  return fmt((job.salary_min ?? job.salary_max)!);
}
