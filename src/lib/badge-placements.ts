import { getDb } from "./db";

/**
 * Tracks where employers have embedded the "We're Hiring" badge, so we can
 * confirm they keep it up in exchange for comped advertising.
 *
 * Two sources feed the same table:
 *  - `declared`  — the URL the employer submitted (authoritative; part of the deal)
 *  - `detected`  — auto-captured from the badge image's Referer header
 *
 * A weekly cron actively fetches each URL and sets `present`; the admin panel
 * shows the status and the owner is emailed when a declared badge goes missing.
 */

export interface BadgePlacement {
  id: number;
  employer_id: number;
  page_url: string;
  source: "declared" | "detected";
  present: boolean | null;
  last_status: string | null;
  first_seen_at: string;
  last_seen_at: string | null;
  last_checked_at: string | null;
  notified_missing_at: string | null;
  created_at: string;
}

/**
 * Does the fetched HTML actually embed this employer's badge? True when it
 * references the badge image (`/api/badge/<id>`) or links to the employer's
 * BoatyardJobs page (`/employers/<id>`) — the two things our embed snippet
 * contains. Pure + unit-tested so the crawl logic is verifiable offline.
 */
export function htmlContainsBadge(html: string, employerId: number): boolean {
  if (!html) return false;
  // Match /api/badge/<id> and /employers/<id> with a boundary after the id so
  // employer 12 isn't matched by a reference to employer 128.
  const re = new RegExp(`/(?:api/badge|employers)/${employerId}(?![0-9])`);
  return re.test(html);
}

/**
 * Record the employer's declared badge page. Treated as the single authoritative
 * URL: any previous declared row for a different URL is dropped, and if the URL
 * was already known (e.g. auto-detected) it's promoted to `declared`.
 */
export async function setDeclaredPlacement(employerId: number, pageUrl: string): Promise<void> {
  const db = getDb();
  await db
    .from("badge_placements")
    .delete()
    .eq("employer_id", employerId)
    .eq("source", "declared")
    .neq("page_url", pageUrl);
  const { error } = await db
    .from("badge_placements")
    .upsert(
      { employer_id: employerId, page_url: pageUrl, source: "declared" },
      { onConflict: "employer_id,page_url" }
    );
  if (error) throw error;
}

/**
 * Passive capture from the badge image Referer. Best-effort: bumps `last_seen_at`
 * for a known URL, or inserts a new `detected` row. Never downgrades a declared
 * row and never touches the active-check fields.
 */
/** Remove the employer's declared badge page (they cleared the field). */
export async function clearDeclaredPlacement(employerId: number): Promise<void> {
  const { error } = await getDb()
    .from("badge_placements")
    .delete()
    .eq("employer_id", employerId)
    .eq("source", "declared");
  if (error) throw error;
}

export async function recordDetectedPlacement(employerId: number, pageUrl: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data } = await db
    .from("badge_placements")
    .update({ last_seen_at: now })
    .eq("employer_id", employerId)
    .eq("page_url", pageUrl)
    .select("id");
  if (!data || data.length === 0) {
    await db
      .from("badge_placements")
      .insert({ employer_id: employerId, page_url: pageUrl, source: "detected", last_seen_at: now });
  }
}

/** The employer's current declared badge URL, if any (for the profile UI). */
export async function getDeclaredPlacement(employerId: number): Promise<BadgePlacement | null> {
  const { data, error } = await getDb()
    .from("badge_placements")
    .select("*")
    .eq("employer_id", employerId)
    .eq("source", "declared")
    .maybeSingle();
  if (error) throw error;
  return (data as BadgePlacement) ?? null;
}

/** All placements for one employer, declared first. */
export async function listPlacementsForEmployer(employerId: number): Promise<BadgePlacement[]> {
  const { data, error } = await getDb()
    .from("badge_placements")
    .select("*")
    .eq("employer_id", employerId)
    .order("source", { ascending: true })
    .order("last_seen_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as BadgePlacement[];
}

/** Every placement, with its employer's company name — for the cron and admin. */
export interface PlacementWithCompany extends BadgePlacement {
  company: string;
}

function withCompany(rows: Record<string, unknown>[]): PlacementWithCompany[] {
  return rows.map((r) => {
    const emp = r.employers as { company?: string } | null;
    const { employers: _e, ...rest } = r;
    void _e;
    return { ...(rest as unknown as BadgePlacement), company: emp?.company ?? "—" };
  });
}

export async function listAllPlacements(): Promise<PlacementWithCompany[]> {
  const { data, error } = await getDb()
    .from("badge_placements")
    .select("*, employers(company)")
    .order("employer_id", { ascending: true });
  if (error) throw error;
  return withCompany(data ?? []);
}

/** Declared placements only — the deal-relevant URLs the cron verifies + alerts on. */
export async function listDeclaredPlacements(): Promise<PlacementWithCompany[]> {
  const { data, error } = await getDb()
    .from("badge_placements")
    .select("*, employers(company)")
    .eq("source", "declared")
    .order("employer_id", { ascending: true });
  if (error) throw error;
  return withCompany(data ?? []);
}

/**
 * Store an active-verification result. On success also stamps `last_seen_at`
 * and clears any prior missing-notification (so a recovery re-arms the alert).
 * Does not touch `notified_missing_at` on failure — the caller sets it after it
 * has actually sent the alert (see `markPlacementNotified`).
 */
export async function recordVerification(
  id: number,
  present: boolean,
  status: string
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    present,
    last_status: status,
    last_checked_at: now,
  };
  if (present) {
    patch.last_seen_at = now;
    patch.notified_missing_at = null;
  }
  const { error } = await getDb().from("badge_placements").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Record that a check couldn't reach/read the page (timeout, 5xx, etc.). Updates
 * only the check timestamp + status — deliberately leaves `present` unchanged so
 * transient downtime never flips a placement to "missing" or fires a false alert.
 */
export async function recordUnreachable(id: number, status: string): Promise<void> {
  const { error } = await getDb()
    .from("badge_placements")
    .update({ last_checked_at: new Date().toISOString(), last_status: status })
    .eq("id", id);
  if (error) throw error;
}

/** Mark that we've emailed the owner about this placement going missing. */
export async function markPlacementNotified(id: number): Promise<void> {
  const { error } = await getDb()
    .from("badge_placements")
    .update({ notified_missing_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
