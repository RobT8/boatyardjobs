import { getDb as getRawDb } from "./db";
import { SEED_JOBS } from "./seedData";

let seeded = false;

/** Returns the DB, populating demo listings on first use of an empty database. */
function getDb() {
  const db = getRawDb();
  if (!seeded) {
    seeded = true;
    const count = (db.prepare("SELECT COUNT(*) AS n FROM jobs").get() as { n: number }).n;
    if (count === 0) for (const job of SEED_JOBS) insertJob(job);
  }
  return db;
}

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

type JobRow = Omit<Job, "certifications"> & { certifications: string };

function parseRow(row: JobRow): Job {
  return { ...row, certifications: JSON.parse(row.certifications) };
}

export function listJobs(filters: JobFilters = {}): { jobs: Job[]; total: number } {
  const db = getDb();
  const where: string[] = ["status = 'published'"];
  const params: Record<string, unknown> = {};

  if (filters.state) {
    where.push("state = @state");
    params.state = filters.state.toUpperCase();
  }
  if (filters.category) {
    where.push("category = @category");
    params.category = filters.category;
  }
  if (filters.q) {
    where.push("(title LIKE @q OR company LIKE @q OR city LIKE @q OR description LIKE @q)");
    params.q = `%${filters.q}%`;
  }

  const whereSql = where.join(" AND ");
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE ${whereSql}`).get(params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT * FROM jobs WHERE ${whereSql}
       ORDER BY featured DESC, posted_at DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: filters.limit ?? 50, offset: filters.offset ?? 0 }) as JobRow[];

  return { jobs: rows.map(parseRow), total };
}

export function getJobBySlug(slug: string): Job | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM jobs WHERE slug = ?").get(slug) as JobRow | undefined;
  return row ? parseRow(row) : null;
}

export function countByState(): { state: string; n: number }[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT state, COUNT(*) AS n FROM jobs WHERE status='published' GROUP BY state ORDER BY n DESC"
    )
    .all() as { state: string; n: number }[];
}

export function countByCategory(): { category: string; n: number }[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT category, COUNT(*) AS n FROM jobs WHERE status='published' GROUP BY category ORDER BY n DESC"
    )
    .all() as { category: string; n: number }[];
}

export function recordApplyClick(jobId: number) {
  getDb().prepare("INSERT INTO apply_clicks (job_id) VALUES (?)").run(jobId);
}

export function createAlert(email: string, state?: string | null, category?: string | null) {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO alerts (email, state, category) VALUES (@email, @state, @category)"
    )
    .run({ email, state: state || null, category: category || null });
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

export function insertJob(input: NewJobInput): string {
  const db = getDb();
  const base = slugify(`${input.title} ${input.company} ${input.city} ${input.state}`);
  let slug = base;
  let i = 2;
  while (db.prepare("SELECT 1 FROM jobs WHERE slug = ?").get(slug)) {
    slug = `${base}-${i++}`;
  }
  db.prepare(
    `INSERT INTO jobs (slug, title, company, city, state, category, employment_type, description,
       salary_min, salary_max, salary_unit, certifications, source, source_url, apply_email, status, posted_at)
     VALUES (@slug, @title, @company, @city, @state, @category, @employment_type, @description,
       @salary_min, @salary_max, @salary_unit, @certifications, @source, @source_url, @apply_email, @status, @posted_at)`
  ).run({
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
    certifications: JSON.stringify(input.certifications ?? []),
    source: input.source ?? "direct",
    source_url: input.source_url ?? null,
    apply_email: input.apply_email ?? null,
    status: input.status ?? "published",
    posted_at: input.posted_at ?? new Date().toISOString(),
  });
  return slug;
}

export type UpsertResult = "created" | "updated" | "unchanged";

/**
 * Insert or refresh an aggregated listing, keyed on (source, source_url) — the
 * stable identity for a job that lives on someone else's site. Returns whether
 * the row was created, updated (content changed), or left unchanged. A listing
 * that had expired comes back to 'published' if it reappears upstream.
 */
export function upsertSourcedJob(input: NewJobInput): UpsertResult {
  const db = getDb();
  const source = input.source ?? "direct";
  if (!input.source_url) {
    // No stable upstream key — fall back to a plain insert.
    insertJob(input);
    return "created";
  }

  const existing = db
    .prepare("SELECT * FROM jobs WHERE source = ? AND source_url = ?")
    .get(source, input.source_url) as JobRow | undefined;

  if (!existing) {
    insertJob(input);
    return "created";
  }

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
    certifications: JSON.stringify(input.certifications ?? []),
  };

  const unchanged =
    existing.status === "published" &&
    existing.title === next.title &&
    existing.company === next.company &&
    existing.city === next.city &&
    existing.state === next.state &&
    existing.category === next.category &&
    existing.employment_type === next.employment_type &&
    existing.description === next.description &&
    existing.salary_min === next.salary_min &&
    existing.salary_max === next.salary_max &&
    existing.salary_unit === next.salary_unit &&
    existing.certifications === next.certifications;

  if (unchanged) return "unchanged";

  db.prepare(
    `UPDATE jobs SET title=@title, company=@company, city=@city, state=@state,
       category=@category, employment_type=@employment_type, description=@description,
       salary_min=@salary_min, salary_max=@salary_max, salary_unit=@salary_unit,
       certifications=@certifications, status='published'
     WHERE id=@id`
  ).run({ ...next, id: existing.id });
  return "updated";
}

/**
 * Mark every published listing from `source` whose source_url is NOT in
 * `seenUrls` as expired — i.e. it vanished upstream since the last run. Returns
 * the number of rows expired. Callers must only invoke this after a *successful*
 * fetch, or a transient upstream outage would wipe the board.
 */
export function expireMissingFromSource(source: string, seenUrls: string[]): number {
  const db = getDb();
  const live = db
    .prepare("SELECT id, source_url FROM jobs WHERE source = ? AND status = 'published'")
    .all(source) as { id: number; source_url: string | null }[];

  const seen = new Set(seenUrls);
  const stale = live.filter((r) => r.source_url && !seen.has(r.source_url));
  if (stale.length === 0) return 0;

  const update = db.prepare("UPDATE jobs SET status='expired' WHERE id = ?");
  const tx = db.transaction((ids: number[]) => ids.forEach((id) => update.run(id)));
  tx(stale.map((r) => r.id));
  return stale.length;
}

export function formatSalary(job: Job): string | null {
  if (job.salary_min == null && job.salary_max == null) return null;
  const fmt = (n: number) =>
    job.salary_unit === "HOUR" ? `$${n}/hr` : `$${Math.round(n / 1000)}k`;
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max)
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  return fmt((job.salary_min ?? job.salary_max)!);
}
