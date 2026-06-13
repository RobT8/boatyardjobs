import { getDb } from "./db";
import type { Job } from "./jobs";

/**
 * Job-alert subscriptions with double opt-in.
 *
 * Flow: createAlert (unconfirmed) → confirmation email with token →
 * confirmAlert sets confirmed=1 → the digest cron emails matching new jobs →
 * unsubscribeAlert deletes the row. All server-side (service-role key).
 */

export interface Alert {
  id: number;
  email: string;
  state: string | null;
  category: string | null;
  confirmed: number;
  token: string;
  created_at: string;
  last_sent_at: string | null;
}

/** Find an existing subscription, treating null state/category correctly. */
async function findAlert(email: string, state: string | null, category: string | null) {
  let q = getDb().from("alerts").select("token, confirmed").eq("email", email);
  q = state ? q.eq("state", state) : q.is("state", null);
  q = category ? q.eq("category", category) : q.is("category", null);
  return (await q.maybeSingle()).data as { token: string; confirmed: number } | null;
}

export async function createAlert(
  email: string,
  state?: string | null,
  category?: string | null
): Promise<{ token: string; alreadyConfirmed: boolean }> {
  const st = state || null;
  const cat = category || null;

  const existing = await findAlert(email, st, cat);
  if (existing) return { token: existing.token, alreadyConfirmed: existing.confirmed === 1 };

  const { data, error } = await getDb()
    .from("alerts")
    .insert({ email, state: st, category: cat })
    .select("token")
    .single();
  if (error) throw error;
  return { token: data.token as string, alreadyConfirmed: false };
}

export async function confirmAlert(token: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("alerts")
    .update({ confirmed: 1 })
    .eq("token", token)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function unsubscribeAlert(token: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("alerts")
    .delete()
    .eq("token", token)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function listConfirmedAlerts(): Promise<Alert[]> {
  const { data, error } = await getDb().from("alerts").select("*").eq("confirmed", 1);
  if (error) throw error;
  return (data ?? []) as Alert[];
}

/** Published jobs matching the alert that are newer than its last send. */
export async function newJobsForAlert(alert: Alert): Promise<Job[]> {
  const cutoff = alert.last_sent_at ?? alert.created_at;
  let q = getDb()
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .gt("posted_at", cutoff)
    .order("posted_at", { ascending: false })
    .limit(25);
  if (alert.state) q = q.eq("state", alert.state);
  if (alert.category) q = q.eq("category", alert.category);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as Job),
    certifications: Array.isArray(r.certifications) ? (r.certifications as string[]) : [],
  }));
}

export async function recordAlertSent(id: number): Promise<void> {
  const { error } = await getDb()
    .from("alerts")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
