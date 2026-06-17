import { getDb } from "./db";

export type LeadInterest = "feature" | "claim" | "general";

export interface NewEmployerLead {
  company: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  job_id?: number | null;
  job_slug?: string | null;
  job_title?: string | null;
  interest?: LeadInterest;
  message?: string | null;
}

export interface EmployerLead extends NewEmployerLead {
  id: number;
  interest: LeadInterest;
  status: string;
  created_at: string;
}

/**
 * Record an employer who wants to feature/claim a listing or hire with us.
 * This is the lead-capture wedge: we already show these companies' jobs on the
 * board, so the ask is "make yours stand out" rather than a cold post.
 */
export async function createEmployerLead(input: NewEmployerLead): Promise<void> {
  const { error } = await getDb().from("employer_leads").insert({
    company: input.company,
    contact_name: input.contact_name ?? null,
    email: input.email,
    phone: input.phone ?? null,
    job_id: input.job_id ?? null,
    job_slug: input.job_slug ?? null,
    job_title: input.job_title ?? null,
    interest: input.interest ?? "feature",
    message: input.message ?? null,
  });
  if (error) throw error;
}

/** Most-recent employer leads for the admin dashboard. */
export async function listEmployerLeads(limit = 25): Promise<EmployerLead[]> {
  const { data, error } = await getDb()
    .from("employer_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmployerLead[];
}
