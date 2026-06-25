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
  city: string | null;
  category: string | null;
  confirmed: number;
  token: string;
  created_at: string;
  last_sent_at: string | null;
}

/** Find an existing subscription, treating null state/city/category correctly. */
async function findAlert(
  email: string,
  state: string | null,
  city: string | null,
  category: string | null
) {
  let q = getDb().from("alerts").select("token, confirmed").eq("email", email);
  q = state ? q.eq("state", state) : q.is("state", null);
  q = city ? q.eq("city", city) : q.is("city", null);
  q = category ? q.eq("category", category) : q.is("category", null);
  return (await q.maybeSingle()).data as { token: string; confirmed: number } | null;
}

export async function createAlert(
  email: string,
  state?: string | null,
  city?: string | null,
  category?: string | null
): Promise<{ token: string; alreadyConfirmed: boolean }> {
  const st = state || null;
  const ct = city || null;
  const cat = category || null;

  const existing = await findAlert(email, st, ct, cat);
  if (existing) return { token: existing.token, alreadyConfirmed: existing.confirmed === 1 };

  const { data, error } = await getDb()
    .from("alerts")
    .insert({ email, state: st, city: ct, category: cat })
    .select("token")
    .single();
  if (error) throw error;
  return { token: data.token as string, alreadyConfirmed: false };
}

/**
 * Confirm the subscription for `token` — and, so a multi-role signup needs only
 * a single click, every other still-unconfirmed alert for the same email. Each
 * row keeps its own token, so per-alert unsubscribe links in digests are
 * unaffected.
 */
export async function confirmAlert(token: string): Promise<boolean> {
  const db = getDb();
  const { data: row, error: lookupError } = await db
    .from("alerts")
    .select("email")
    .eq("token", token)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!row) return false;

  const { error } = await db
    .from("alerts")
    .update({ confirmed: 1 })
    .eq("email", row.email as string)
    .eq("confirmed", 0);
  if (error) throw error;
  return true;
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

/** One searched (state/city/category) combination a subscriber asked for. */
export interface AlertFilter {
  state: string | null;
  city: string | null;
  category: string | null;
}

/** A subscriber, with every role/location combination they signed up for. */
export interface AlertSubscriber {
  email: string;
  confirmed: boolean;
  /** Earliest signup across their rows. */
  created_at: string;
  /** Most recent digest send across their rows (null if never). */
  last_sent_at: string | null;
  filters: AlertFilter[];
}

/**
 * All alert subscribers for the admin view, folded to one row per email with
 * their filter combinations listed. A subscriber counts as confirmed once any
 * of their rows is confirmed (confirmation is per-email, see confirmAlert).
 * Newest signups first.
 */
export async function listAlertSubscribers(): Promise<AlertSubscriber[]> {
  const { data, error } = await getDb()
    .from("alerts")
    .select("email, state, city, category, confirmed, created_at, last_sent_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byEmail = new Map<string, AlertSubscriber>();
  for (const r of (data ?? []) as Alert[]) {
    const sub = byEmail.get(r.email) ?? {
      email: r.email,
      confirmed: false,
      created_at: r.created_at,
      last_sent_at: null,
      filters: [],
    };
    sub.confirmed = sub.confirmed || r.confirmed === 1;
    if (r.created_at < sub.created_at) sub.created_at = r.created_at;
    if (r.last_sent_at && (!sub.last_sent_at || r.last_sent_at > sub.last_sent_at)) {
      sub.last_sent_at = r.last_sent_at;
    }
    sub.filters.push({ state: r.state, city: r.city, category: r.category });
    byEmail.set(r.email, sub);
  }
  return [...byEmail.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  if (alert.city) q = q.eq("city", alert.city);
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
