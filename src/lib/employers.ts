import { getDb } from "./db";
import type { Job } from "./jobs";

/** Employer accounts that own direct job posts. */
export interface Employer {
  id: number;
  company: string;
  email: string;
  password_hash: string | null;
  stripe_customer_id: string | null;
  login_token: string;
  created_at: string;
  /** Company website → schema.org hiringOrganization.sameAs on the employer's listings. */
  website: string | null;
  /** Company logo URL → hiringOrganization.logo. */
  logo_url: string | null;
  /** Admin-controlled: renders the detailed public profile when true. */
  enhanced_profile: boolean;
  /** Company bio shown on the detailed profile page. */
  about: string | null;
}

export async function createEmployerWithPassword(
  company: string,
  email: string,
  passwordHash: string
): Promise<Employer> {
  const { data, error } = await getDb()
    .from("employers")
    .insert({ company, email, password_hash: passwordHash })
    .select("*")
    .single();
  if (error) throw error;
  return data as Employer;
}

/**
 * Find an employer by email or create a passwordless one (e.g. when an admin
 * posts a job on a client's behalf). The client can later claim the account via
 * the magic-link login.
 */
export async function upsertEmployer(company: string, email: string): Promise<Employer> {
  const existing = await getEmployerByEmail(email);
  if (existing) return existing;
  const { data, error } = await getDb()
    .from("employers")
    .insert({ company, email })
    .select("*")
    .single();
  if (error) throw error;
  return data as Employer;
}

export async function getEmployerByEmail(email: string): Promise<Employer | null> {
  const { data, error } = await getDb()
    .from("employers")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as Employer) ?? null;
}

export async function getEmployerByToken(token: string): Promise<Employer | null> {
  const { data, error } = await getDb()
    .from("employers")
    .select("*")
    .eq("login_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as Employer) ?? null;
}

export async function getEmployerById(id: number): Promise<Employer | null> {
  const { data, error } = await getDb().from("employers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Employer) ?? null;
}

export async function setEmployerPassword(id: number, passwordHash: string): Promise<void> {
  const { error } = await getDb()
    .from("employers")
    .update({ password_hash: passwordHash })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Update an employer's company branding (website + logo URL), used to enrich the
 * schema.org hiringOrganization on all their listings. Each field is set
 * independently; passing null clears it.
 */
export async function updateEmployerProfile(
  id: number,
  fields: { website?: string | null; logo_url?: string | null; about?: string | null }
): Promise<void> {
  const patch: Record<string, string | null> = {};
  if ("website" in fields) patch.website = fields.website ?? null;
  if ("logo_url" in fields) patch.logo_url = fields.logo_url ?? null;
  if ("about" in fields) patch.about = fields.about ?? null;
  if (Object.keys(patch).length === 0) return;
  const { error } = await getDb().from("employers").update(patch).eq("id", id);
  if (error) throw error;
}

/** Admin toggle: grant/revoke the detailed public profile for an employer. */
export async function setEnhancedProfile(id: number, enhanced: boolean): Promise<void> {
  const { error } = await getDb()
    .from("employers")
    .update({ enhanced_profile: enhanced })
    .eq("id", id);
  if (error) throw error;
}

/** Every employer, newest first — for the admin badge-deals / profile panel. */
export async function listAllEmployers(): Promise<Employer[]> {
  const { data, error } = await getDb()
    .from("employers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Employer[];
}

export async function setEmployerStripeCustomer(id: number, customerId: string): Promise<void> {
  const { error } = await getDb()
    .from("employers")
    .update({ stripe_customer_id: customerId })
    .eq("id", id);
  if (error) throw error;
}

/** Count of an employer's currently-published listings. Cheap head-count query,
 *  used by the embeddable "We're Hiring" badge. */
export async function countEmployerPublishedJobs(employerId: number): Promise<number> {
  const { count, error } = await getDb()
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .eq("status", "published");
  if (error) throw error;
  return count ?? 0;
}

/** An employer's currently-published listings, newest first — for their public
 *  profile page (the badge's backlink target). */
export async function listEmployerPublishedJobs(employerId: number): Promise<Job[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("*")
    .eq("employer_id", employerId)
    .eq("status", "published")
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

/** Employer ids that have at least one published listing — drives the sitemap so
 *  the public employer pages (badge backlink targets) get indexed. */
export async function listEmployerIdsWithPublishedJobs(): Promise<number[]> {
  const { data, error } = await getDb()
    .from("jobs")
    .select("employer_id")
    .eq("status", "published")
    .not("employer_id", "is", null);
  if (error) throw error;
  const ids = new Set<number>();
  for (const r of data ?? []) if (r.employer_id != null) ids.add(r.employer_id as number);
  return [...ids];
}

export interface EmployerJob {
  job: Job;
  views: number;
  clicks: number;
}

function normalizeJob(row: Record<string, unknown>): Job {
  return {
    ...(row as unknown as Job),
    certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : [],
  };
}

/** An employer's job posts with per-listing views (pageviews) and apply clicks. */
export async function listEmployerJobs(employerId: number): Promise<EmployerJob[]> {
  const db = getDb();
  const { data: jobs, error } = await db
    .from("jobs")
    .select("*")
    .eq("employer_id", employerId)
    .order("posted_at", { ascending: false });
  if (error) throw error;

  const rows = (jobs ?? []).map(normalizeJob);
  if (rows.length === 0) return [];

  const ids = rows.map((j) => j.id);
  const paths = rows.map((j) => `/jobs/${j.slug}`);

  const [{ data: clicks }, { data: views }] = await Promise.all([
    db.from("apply_clicks").select("job_id").in("job_id", ids),
    db.from("page_views").select("path").in("path", paths),
  ]);

  const clickCount = new Map<number, number>();
  for (const c of clicks ?? []) clickCount.set(c.job_id as number, (clickCount.get(c.job_id as number) ?? 0) + 1);
  const viewCount = new Map<string, number>();
  for (const v of views ?? []) viewCount.set(v.path as string, (viewCount.get(v.path as string) ?? 0) + 1);

  return rows.map((job) => ({
    job,
    views: viewCount.get(`/jobs/${job.slug}`) ?? 0,
    clicks: clickCount.get(job.id) ?? 0,
  }));
}
