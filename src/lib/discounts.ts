import { getDb } from "./db";

/**
 * Percentage discount codes the admin sets "in the background", optionally
 * limited to a date window, a use count, and whether they apply to job posts,
 * adverts, or both. Validated server-side at checkout; the Stripe webhook
 * records a use once payment clears.
 */
export type DiscountContext = "jobs" | "ads";

export interface DiscountCode {
  id: number;
  code: string;
  percent_off: number;
  applies_to: "jobs" | "ads" | "both";
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await getDb()
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DiscountCode[];
}

export async function createDiscountCode(input: {
  code: string;
  percent_off: number;
  applies_to: "jobs" | "ads" | "both";
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
}): Promise<void> {
  const { error } = await getDb()
    .from("discount_codes")
    .insert({ ...input, code: input.code.trim().toUpperCase() });
  if (error) throw error;
}

export async function setDiscountActive(id: number, active: boolean): Promise<void> {
  const { error } = await getDb().from("discount_codes").update({ active }).eq("id", id);
  if (error) throw error;
}

/**
 * Return the code if it's usable for `context` right now — active, in its date
 * window, under its use cap, and applicable to this kind of purchase. Otherwise
 * null. Matching is case-insensitive.
 */
export async function getValidDiscount(
  code: string,
  context: DiscountContext
): Promise<DiscountCode | null> {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const { data, error } = await getDb()
    .from("discount_codes")
    .select("*")
    .eq("code", c)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as DiscountCode;
  if (!d.active) return null;
  if (d.applies_to !== "both" && d.applies_to !== context) return null;
  const now = Date.now();
  if (d.valid_from && new Date(d.valid_from).getTime() > now) return null;
  if (d.valid_until && new Date(d.valid_until).getTime() < now) return null;
  if (d.max_uses != null && d.used_count >= d.max_uses) return null;
  return d;
}

/** Apply a whole-number percentage off a cents amount (never below zero). */
export function applyDiscountCents(cents: number, percentOff: number): number {
  return Math.max(0, Math.round(cents * (1 - percentOff / 100)));
}

/** Record one use. Read-then-write — fine at this volume (no concurrent rush). */
export async function incrementDiscountUse(id: number): Promise<void> {
  const db = getDb();
  const { data, error } = await db
    .from("discount_codes")
    .select("used_count")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const { error: updErr } = await db
    .from("discount_codes")
    .update({ used_count: (data.used_count as number) + 1 })
    .eq("id", id);
  if (updErr) throw updErr;
}
