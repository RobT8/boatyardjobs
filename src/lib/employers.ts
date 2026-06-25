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

export async function setEmployerStripeCustomer(id: number, customerId: string): Promise<void> {
  const { error } = await getDb()
    .from("employers")
    .update({ stripe_customer_id: customerId })
    .eq("id", id);
  if (error) throw error;
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
