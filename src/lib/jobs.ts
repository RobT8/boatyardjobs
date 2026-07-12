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
  /** Street address of the job location (direct listings only; feed jobs lack it). */
  street_address: string | null;
  /** Postal/ZIP code of the job location (direct listings only). */
  postal_code: string | null;
  source: string;
  source_url: string | null;
  apply_email: string | null;
  featured: number;
  /** Generated display tier: 0 featured · 1 direct/paid · 2 scraped feed. */
  listing_rank: number;
  status: string;
  posted_at: string;
  expires_at: string | null;
  employer_id: number | null;
}

export interface JobFilters {
  q?: string;
  state?: string | string[];
  city?: string | string[];
  category?: string | string[];
  company?: string | string[];
  /** Only featured listings. */
  onlyFeatured?: boolean;
  /** Hide featured listings (so they can be shown separately at the top). */
  excludeFeatured?: boolean;
  /** Result ordering for the main list. */
  sort?: "newest" | "oldest" | "salary";
  limit?: number;
  offset?: number;
}

/**
 * Apply an equality filter that accepts a single value or a list: one value
 * uses `.eq`, several use `.in`, none is a no-op. Empty strings are dropped so
 * an "All …" selection doesn't filter anything out.
 */
function applyMulti<Q>(query: Q, column: string, value?: string | string[], upper = false): Q {
  const vals = (value == null ? [] : Array.isArray(value) ? value : [value])
    .map((v) => (upper ? v.toUpperCase() : v))
    .filter((v) => v !== "");
  if (vals.length === 0) return query;
  const q = query as unknown as {
    eq: (c: string, v: string) => Q;
    in: (c: string, v: string[]) => Q;
  };
  return vals.length === 1 ? q.eq(column, vals[0]) : q.in(column, vals);
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

  query = applyMulti(query, "state", filters.state, true);
  query = applyMulti(query, "city", filters.city);
  query = applyMulti(query, "category", filters.category);
  query = applyMulti(query, "company", filters.company);
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

  // Tier first — featured, then direct/paid, then scraped feed (listing_rank
  // generated column) — so the board always reads in that order regardless of
  // the chosen within-tier sort.
  let ordered = query.order("listing_rank", { ascending: true });
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
  query = applyMulti(query, "state", filters.state, true);
  query = applyMulti(query, "city", filters.city);
  query = applyMulti(query, "category", filters.category);
  query = applyMulti(query, "company", filters.company);
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

export interface CityCount {
  /** Canonical display name — the most common stored spelling for the city. */
  city: string;
  state: string;
  n: number;
}

/**
 * Published-job counts per (city, state), aggregated in-app from the live rows.
 * Unlike the state/category counts there's no dedicated DB view, because city is
 * free-form upstream text: we fold case/spelling variants together on the
 * slug and surface the most common spelling as the display name. Powers the
 * programmatic city landing pages, their cross-links and the sitemap.
 */
export async function countByCity(): Promise<CityCount[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("city, state")
    .eq("status", "published");
  if (error) throw error;

  // Group on (state, lowercased city); track each raw spelling's frequency so we
  // can pick the most common as the canonical display name.
  const groups = new Map<string, { state: string; n: number; spellings: Map<string, number> }>();
  for (const row of (data ?? []) as { city: string | null; state: string | null }[]) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    if (!city || !state) continue;
    const key = `${state}|${city.toLowerCase()}`;
    const g = groups.get(key) ?? { state, n: 0, spellings: new Map() };
    g.n++;
    g.spellings.set(city, (g.spellings.get(city) ?? 0) + 1);
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => {
      const city = [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { city, state: g.state, n: g.n };
    })
    .sort((a, b) => b.n - a.n);
}

export interface CityCategoryCount {
  /** Canonical display name — the most common stored spelling for the city. */
  city: string;
  state: string;
  category: string;
  n: number;
}

/**
 * Published-job counts per (city, state, category), aggregated in-app from the
 * live rows. Like {@link countByCity} there's no DB view because city is
 * free-form upstream text — we fold case/spelling variants on the slug and reuse
 * the same canonical (most common) spelling as the display name, so a city reads
 * identically on its city page and its role×city pages. Powers the programmatic
 * role×city landing pages, their cross-links and the sitemap.
 */
export async function countByCityAndCategory(): Promise<CityCategoryCount[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("city, state, category")
    .eq("status", "published");
  if (error) throw error;

  // First pass: pick each (state, city) group's canonical spelling from all its
  // rows, so the display name doesn't depend on which category we're counting.
  const spellings = new Map<string, Map<string, number>>();
  // Second pass key: `${state}|${lcCity}|${category}` → count.
  const counts = new Map<string, { state: string; lcCity: string; category: string; n: number }>();

  for (const row of (data ?? []) as {
    city: string | null;
    state: string | null;
    category: string | null;
  }[]) {
    const city = row.city?.trim();
    const state = row.state?.trim();
    const category = row.category?.trim();
    if (!city || !state || !category) continue;
    const lcCity = city.toLowerCase();
    const cityKey = `${state}|${lcCity}`;
    const sp = spellings.get(cityKey) ?? new Map<string, number>();
    sp.set(city, (sp.get(city) ?? 0) + 1);
    spellings.set(cityKey, sp);

    const key = `${cityKey}|${category}`;
    const c = counts.get(key) ?? { state, lcCity, category, n: 0 };
    c.n++;
    counts.set(key, c);
  }

  const canonical = (state: string, lcCity: string): string => {
    const sp = spellings.get(`${state}|${lcCity}`);
    if (!sp) return lcCity;
    return [...sp.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  return [...counts.values()]
    .map((c) => ({ city: canonical(c.state, c.lcCity), state: c.state, category: c.category, n: c.n }))
    .sort((a, b) => b.n - a.n);
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
  street_address?: string | null;
  postal_code?: string | null;
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

/**
 * How long a site-bought ("direct") listing stays live before it expires.
 * Feed-aggregated listings don't use this — they're governed by the
 * upstream-vanish and age-cap logic instead.
 */
export const DIRECT_JOB_DAYS = 30;

/** ISO timestamp `days` days after `fromIso` (defaults to now). */
export function addDaysIso(fromIso: string | undefined, days: number): string {
  const d = fromIso ? new Date(fromIso) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toRow(input: NewJobInput, slug: string) {
  const source = input.source ?? "direct";
  const status = input.status ?? "published";
  const posted_at = input.posted_at ?? new Date().toISOString();
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
    street_address: input.street_address ?? null,
    postal_code: input.postal_code ?? null,
    source,
    source_url: input.source_url ?? null,
    apply_email: input.apply_email ?? null,
    status,
    posted_at,
    employer_id: input.employer_id ?? null,
    featured: input.featured ?? 0,
    // A direct listing that's already published gets a fixed run; one created
    // as 'unpaid' has its expiry stamped at publish time (see publishPaidJob).
    expires_at:
      source === "direct" && status === "published"
        ? addDaysIso(posted_at, DIRECT_JOB_DAYS)
        : null,
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
 * published (so repeated webhook deliveries are safe). Returns the listing's
 * slug if it acted (so the caller can notify search engines), else null.
 */
export async function publishPaidJob(jobId: number): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await getDb()
    .from("jobs")
    .update({
      status: "published",
      posted_at: now,
      // Start the paid run from the moment payment clears.
      expires_at: addDaysIso(now, DIRECT_JOB_DAYS),
    })
    .eq("id", jobId)
    .eq("status", "unpaid")
    .select("slug");
  if (error) throw error;
  return (data?.[0]?.slug as string) ?? null;
}

/** Free/reviewed submissions awaiting admin approval, newest first. */
export async function listPendingJobs(): Promise<Job[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("*")
    .eq("status", "pending")
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/**
 * Approve a free/reviewed submission: flip 'pending' → 'published' with a fresh
 * {@link DIRECT_JOB_DAYS} run. Idempotent (only acts on a still-'pending' row),
 * so a double-click is safe. Returns the slug if it acted (so the caller can
 * notify search engines), else null.
 */
export async function publishPendingJob(jobId: number): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await getDb()
    .from("jobs")
    .update({
      status: "published",
      posted_at: now,
      expires_at: addDaysIso(now, DIRECT_JOB_DAYS),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("slug");
  if (error) throw error;
  return (data?.[0]?.slug as string) ?? null;
}

/** Reject a pending submission by retiring it (kept for the record, not deleted). */
export async function rejectPendingJob(jobId: number): Promise<void> {
  const { error } = await getDb()
    .from("jobs")
    .update({ status: "expired" })
    .eq("id", jobId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * Hard age cap for listings pulled from an external feed: anything still on the
 * board past this many months is retired, even if it's still appearing upstream
 * (some employers leave evergreen reqs posted long after they're filled). Ads
 * bought directly through the site (source 'direct') are NEVER age-capped — they
 * stay until the buyer/admin pulls them.
 */
export const FEED_MAX_AGE_MONTHS = 9;

/** ISO timestamp `months` calendar-months before now (used as an age cutoff). */
function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

/**
 * The date a listing is valid through, for schema.org `validThrough` (Google
 * for Jobs strongly prefers a dated posting). Direct listings carry a real
 * `expires_at`; feed listings store none but are hard-retired at the age cap,
 * so we surface that upper bound (`posted_at + FEED_MAX_AGE_MONTHS`). If it
 * vanishes upstream sooner the aggregation cron expires the row and the page
 * 404s, so Google drops it on the next crawl regardless.
 */
export function jobValidThroughIso(job: Pick<Job, "expires_at" | "posted_at">): string {
  if (job.expires_at) return job.expires_at;
  const d = new Date(job.posted_at);
  d.setMonth(d.getMonth() + FEED_MAX_AGE_MONTHS);
  return d.toISOString();
}

export type UpsertResult = "created" | "updated" | "unchanged";

/** Outcome of an upsert plus the affected listing's slug (null when unchanged
 *  or when nothing was written), so callers can notify search engines. */
export interface UpsertOutcome {
  result: UpsertResult;
  slug: string | null;
}

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
export async function upsertSourcedJob(input: NewJobInput): Promise<UpsertOutcome> {
  const db = getDb();
  const source = input.source ?? "direct";

  // Age cap: a feed listing past FEED_MAX_AGE_MONTHS must never be on the board,
  // even though it's still coming back upstream. Retire it if we already hold it,
  // and never (re)insert it. Without this, the upsert below would flip an
  // age-expired row back to 'published' on every run. Direct ads are exempt.
  if (
    source !== "direct" &&
    input.posted_at != null &&
    input.posted_at < monthsAgoIso(FEED_MAX_AGE_MONTHS)
  ) {
    if (input.source_url) {
      const { error } = await db
        .from("jobs")
        .update({ status: "expired" })
        .eq("source", source)
        .eq("source_url", input.source_url)
        .eq("status", "published");
      if (error) throw error;
    }
    return { result: "unchanged", slug: null };
  }

  if (!input.source_url) {
    // No stable upstream key — only insert if it isn't already on the board.
    if (await publishedDuplicateExists(input)) return { result: "unchanged", slug: null };
    const { slug } = await insertJob(input);
    return { result: "created", slug };
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
    if (await publishedDuplicateExists(input)) return { result: "unchanged", slug: null };
    const { slug } = await insertJob(input);
    return { result: "created", slug };
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

  if (unchanged) return { result: "unchanged", slug: ex.slug };

  const { error: updErr } = await db
    .from("jobs")
    .update({ ...next, status: "published" })
    .eq("id", ex.id);
  if (updErr) throw updErr;
  return { result: "updated", slug: ex.slug };
}

/**
 * Mark every published listing from `source` whose source_url is NOT in
 * `seenUrls` as expired — i.e. it vanished upstream since the last run. Returns
 * the number of rows expired. Callers must only invoke this after a *successful*
 * fetch, or a transient upstream outage would wipe the board. Returns the slugs
 * of the expired listings (so callers can notify search engines).
 */
export async function expireMissingFromSource(source: string, seenUrls: string[]): Promise<string[]> {
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
  if (staleIds.length === 0) return [];

  const { data, error: updErr } = await db
    .from("jobs")
    .update({ status: "expired" })
    .in("id", staleIds)
    .select("slug");
  if (updErr) throw updErr;
  return (data ?? []).map((r) => r.slug as string);
}

/**
 * Retire every published feed listing older than `maxAgeMonths`, regardless of
 * whether it still appears upstream. Ads bought directly through the site
 * (source 'direct') are exempt and never age out. Returns the number expired.
 *
 * This is the authoritative, source-independent enforcement of the age cap: it
 * runs once per aggregation pass (after the per-source loop) so a source whose
 * fetch failed that run still gets its aged rows swept. Returns the slugs of
 * the expired listings (so callers can notify search engines).
 */
export async function expireAgedFeedJobs(maxAgeMonths = FEED_MAX_AGE_MONTHS): Promise<string[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .update({ status: "expired" })
    .eq("status", "published")
    .neq("source", "direct")
    .lt("posted_at", monthsAgoIso(maxAgeMonths))
    .select("slug");
  if (error) throw error;
  return (data ?? []).map((r) => r.slug as string);
}

/**
 * Retire every direct (site-bought) listing whose fixed run has elapsed, i.e.
 * a published 'direct' job with an `expires_at` in the past. Run daily. Returns
 * the slugs of the expired listings. The employer can renew to restart the clock.
 */
export async function expireOverdueDirectJobs(): Promise<string[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .update({ status: "expired" })
    .eq("status", "published")
    .eq("source", "direct")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .select("slug");
  if (error) throw error;
  return (data ?? []).map((r) => r.slug as string);
}

/**
 * Extend a direct listing's run by another {@link DIRECT_JOB_DAYS}, re-publish
 * it if it had expired, and clear the "warned" flag so the next expiry warning
 * can fire. Idempotent per Stripe checkout session: a retried webhook with the
 * same `sessionId` is a no-op, so the run is never double-extended. Remaining
 * days on a still-live listing are preserved (we extend from its current end).
 * Returns the listing's slug if it acted (for search-engine notification), else
 * null.
 */
export async function renewDirectJob(jobId: number, sessionId: string): Promise<string | null> {
  const db = getDb();
  const { data: job, error } = await db
    .from("jobs")
    .select("expires_at, source, stripe_session_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job || job.source !== "direct") return null;
  if (job.stripe_session_id === sessionId) return null; // already applied

  const now = new Date();
  const currentEnd = job.expires_at ? new Date(job.expires_at as string) : null;
  const base = currentEnd && currentEnd > now ? currentEnd.toISOString() : now.toISOString();

  const { data, error: updErr } = await db
    .from("jobs")
    .update({
      status: "published",
      expires_at: addDaysIso(base, DIRECT_JOB_DAYS),
      expiry_warned_at: null,
      stripe_session_id: sessionId,
    })
    .eq("id", jobId)
    .neq("stripe_session_id", sessionId)
    .select("slug");
  if (updErr) throw updErr;
  return (data?.[0]?.slug as string) ?? null;
}

/** A soon-to-expire direct listing plus the employer to warn (if any). */
export interface ExpiringJob {
  id: number;
  slug: string;
  title: string;
  company: string;
  expires_at: string;
  employer: { id: number; email: string; login_token: string } | null;
}

/**
 * Published direct listings whose run ends within `days` and that haven't been
 * warned yet — the input to the daily expiry-warning email.
 */
export async function jobsExpiringWithin(days: number): Promise<ExpiringJob[]> {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  const { data, error } = await getDb()
    .from("jobs")
    .select(
      "id, slug, title, company, expires_at, employer:employers!jobs_employer_id_fkey(id, email, login_token)"
    )
    .eq("status", "published")
    .eq("source", "direct")
    .is("expiry_warned_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now.toISOString())
    .lte("expires_at", until.toISOString());
  if (error) throw error;
  // PostgREST types the embedded relation as an array; collapse to one row.
  return (data ?? []).map((r) => {
    const emp = (r as { employer?: unknown }).employer;
    const employer = Array.isArray(emp) ? emp[0] ?? null : emp ?? null;
    return { ...(r as unknown as ExpiringJob), employer };
  });
}

export async function markJobExpiryWarned(id: number): Promise<void> {
  const { error } = await getDb()
    .from("jobs")
    .update({ expiry_warned_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
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

/**
 * Render a job description as escaped HTML paragraphs for the schema.org
 * JobPosting `description` field. Google for Jobs displays this markup, so we
 * emit one `<p>` per readable paragraph (via {@link descriptionParagraphs}) and
 * escape `&`, `<`, `>` in the text so the embedded HTML stays valid even when a
 * scraped description contains those characters.
 */
export function descriptionHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return descriptionParagraphs(text)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
}

/** Company-level branding for the hiring organization, pulled from the employer
 *  that owns a direct listing. Both fields optional — absent for feed jobs. */
export interface HiringOrgBranding {
  /** Employer website → hiringOrganization.sameAs (links the company in the widget). */
  website?: string | null;
  /** Employer logo URL → hiringOrganization.logo. */
  logo?: string | null;
}

/**
 * Build schema.org JobPosting JSON-LD for a listing — required for Google for
 * Jobs inclusion. Pure (no I/O) so it can be unit-tested. Pass the owning
 * employer's `branding` to enrich `hiringOrganization` with the company website
 * (sameAs) and logo; omit it for feed listings that have no employer.
 */
export function jobPostingJsonLd(job: Job, branding?: HiringOrgBranding): Record<string, unknown> {
  const hiringOrganization: Record<string, unknown> = {
    "@type": "Organization",
    name: job.company,
  };
  // Link the company in the jobs widget when we know its site/logo.
  if (branding?.website) hiringOrganization.sameAs = branding.website;
  if (branding?.logo) hiringOrganization.logo = branding.logo;

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    addressLocality: job.city,
    addressRegion: job.state,
    addressCountry: "US",
  };
  // streetAddress/postalCode are only present on direct listings; including them
  // when known earns a map pin and clears the GSC "improve appearance" warnings.
  if (job.street_address) address.streetAddress = job.street_address;
  if (job.postal_code) address.postalCode = job.postal_code;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    // HTML description with real paragraph breaks (Google for Jobs renders this).
    description: descriptionHtml(job.description),
    datePosted: job.posted_at.slice(0, 10),
    employmentType: job.employment_type,
    // Google uses identifier to de-duplicate the same posting across boards.
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: String(job.id),
    },
    // True when the candidate applies on our site rather than an external listing.
    directApply: job.source === "direct",
    hiringOrganization,
    jobLocation: { "@type": "Place", address },
  };
  // Always dated: real expiry for direct listings, the age-cap bound for feed
  // listings. Google for Jobs strongly prefers a posting with validThrough.
  ld.validThrough = jobValidThroughIso(job).slice(0, 10);
  if (job.salary_min != null || job.salary_max != null) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salary_min ?? undefined,
        maxValue: job.salary_max ?? undefined,
        unitText: job.salary_unit,
      },
    };
  }
  return ld;
}

export function formatSalary(job: Job): string | null {
  if (job.salary_min == null && job.salary_max == null) return null;
  const fmt = (n: number) =>
    job.salary_unit === "HOUR" ? `$${n}/hr` : `$${Math.round(n / 1000)}k`;
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max)
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  return fmt((job.salary_min ?? job.salary_max)!);
}
