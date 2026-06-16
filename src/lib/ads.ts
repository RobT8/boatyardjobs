import { getDb } from "./db";

/**
 * Ad manager — self-serve sponsorships.
 *
 * Two slots only (keeping the site clean): banners on job-detail pages and a
 * sponsor block in the job-alert digest email. Advertisers buy one or both, on a
 * recurring monthly subscription or a fixed 1/3/6-month term. Ads rotate within
 * each slot up to a cap, and only render once their current creative is approved.
 */

export type ChannelKey = "job_pages" | "email_alerts";

export interface AdChannel {
  key: ChannelKey;
  label: string;
  blurb: string;
  priceCents: number; // per month
  cap: number; // max simultaneous advertisers in rotation
}

export const AD_CHANNELS: AdChannel[] = [
  {
    key: "job_pages",
    label: "Job pages",
    blurb:
      "Your banner on job-detail pages — the highest-intent spot on the board, in front of candidates reading a role. Optionally target a single state or trade.",
    priceCents: 9900,
    cap: 4,
  },
  {
    key: "email_alerts",
    label: "Email alerts",
    blurb:
      "A sponsor block in the job-alert digest emails we send to confirmed subscribers — straight into the inbox of engaged marine-trades candidates.",
    priceCents: 9900,
    cap: 4,
  },
];

export interface AdTerm {
  months: number;
  discountPct: number;
}

/** Fixed-period options. Recurring is handled separately (monthly, no discount). */
export const AD_TERMS: AdTerm[] = [
  { months: 1, discountPct: 0 },
  { months: 3, discountPct: 5 },
  { months: 6, discountPct: 10 },
];

export const AD_CURRENCY = "usd";

export function getChannel(key: string): AdChannel | undefined {
  return AD_CHANNELS.find((c) => c.key === key);
}

/** Keep only recognised channel keys, de-duplicated. */
export function sanitizeChannels(input: string[]): ChannelKey[] {
  const keys = AD_CHANNELS.map((c) => c.key);
  return [...new Set(input)].filter((k): k is ChannelKey =>
    (keys as string[]).includes(k)
  );
}

export function monthlyTotalCents(channels: ChannelKey[]): number {
  return channels.reduce((sum, k) => sum + (getChannel(k)?.priceCents ?? 0), 0);
}

export function getTerm(months: number): AdTerm | undefined {
  return AD_TERMS.find((t) => t.months === months);
}

/** Total charge for a fixed term, applying the term discount. */
export function fixedTotalCents(channels: ChannelKey[], months: number): number {
  const term = getTerm(months);
  if (!term) return 0;
  const gross = monthlyTotalCents(channels) * months;
  return Math.round(gross * (1 - term.discountPct / 100));
}

export function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface Advertiser {
  id: number;
  company: string;
  email: string;
  stripe_customer_id: string | null;
  login_token: string;
  created_at: string;
}

export interface Ad {
  id: number;
  advertiser_id: number;
  channels: ChannelKey[];
  period_type: "recurring" | "fixed";
  months: number | null;
  status: string;
  target_state: string | null;
  target_category: string | null;
  price_cents: number;
  stripe_subscription_id: string | null;
  stripe_session_id: string | null;
  current_period_end: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdCreative {
  id: number;
  ad_id: number;
  image_path: string;
  image_url: string;
  target_url: string;
  approval_status: "pending" | "approved" | "rejected";
  is_current: boolean;
  created_at: string;
}

/** A creative ready to render in a slot. */
export interface ServableAd {
  adId: number;
  creativeId: number;
  imageUrl: string;
  targetUrl: string;
}

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

/** Reuse an advertiser by email, or create one. */
export async function upsertAdvertiser(company: string, email: string): Promise<Advertiser> {
  const db = getDb();
  const { data: existing } = await db
    .from("advertisers")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return existing as Advertiser;

  const { data, error } = await db
    .from("advertisers")
    .insert({ company, email })
    .select("*")
    .single();
  if (error) throw error;
  return data as Advertiser;
}

export async function createAd(input: {
  advertiser_id: number;
  channels: ChannelKey[];
  period_type: "recurring" | "fixed";
  months: number | null;
  target_state: string | null;
  target_category: string | null;
  price_cents: number;
}): Promise<number> {
  const { data, error } = await getDb()
    .from("ads")
    .insert({ ...input, status: "pending_payment" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Add a new creative version — becomes current + pending; supersedes prior ones. */
export async function addCreative(
  adId: number,
  imagePath: string,
  imageUrl: string,
  targetUrl: string
): Promise<number> {
  const db = getDb();
  await db.from("ad_creatives").update({ is_current: false }).eq("ad_id", adId);
  const { data, error } = await db
    .from("ad_creatives")
    .insert({
      ad_id: adId,
      image_path: imagePath,
      image_url: imageUrl,
      target_url: targetUrl,
      is_current: true,
      approval_status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function setAdStripeSession(adId: number, sessionId: string): Promise<void> {
  const { error } = await getDb().from("ads").update({ stripe_session_id: sessionId }).eq("id", adId);
  if (error) throw error;
}

export async function updateAd(adId: number, fields: Partial<Ad>): Promise<void> {
  const { error } = await getDb().from("ads").update(fields).eq("id", adId);
  if (error) throw error;
}

export async function setAdvertiserStripeCustomer(
  advertiserId: number,
  customerId: string
): Promise<void> {
  const { error } = await getDb()
    .from("advertisers")
    .update({ stripe_customer_id: customerId })
    .eq("id", advertiserId);
  if (error) throw error;
}

export async function setAdStatusBySubscription(
  subscriptionId: string,
  status: string,
  currentPeriodEnd?: string | null
): Promise<void> {
  const fields: Partial<Ad> = { status };
  if (currentPeriodEnd !== undefined) fields.current_period_end = currentPeriodEnd;
  const { error } = await getDb()
    .from("ads")
    .update(fields)
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw error;
}

export async function recordAdEvent(adId: number, kind: "impression" | "click"): Promise<void> {
  const { error } = await getDb().rpc("record_ad_event", { p_ad_id: adId, p_kind: kind });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Read paths
// ---------------------------------------------------------------------------

export async function getAdById(adId: number): Promise<Ad | null> {
  const { data, error } = await getDb().from("ads").select("*").eq("id", adId).maybeSingle();
  if (error) throw error;
  return (data as Ad) ?? null;
}

export async function getCurrentCreative(adId: number): Promise<AdCreative | null> {
  const { data, error } = await getDb()
    .from("ad_creatives")
    .select("*")
    .eq("ad_id", adId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as AdCreative) ?? null;
}

export async function getAdvertiserByToken(token: string): Promise<Advertiser | null> {
  const { data, error } = await getDb()
    .from("advertisers")
    .select("*")
    .eq("login_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as Advertiser) ?? null;
}

export async function getAdvertiserByEmail(email: string): Promise<Advertiser | null> {
  const { data, error } = await getDb()
    .from("advertisers")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as Advertiser) ?? null;
}

/** How full each rotation slot is — drives the "sold out" state on /advertise. */
export async function channelAvailability(): Promise<
  Record<ChannelKey, { used: number; cap: number; soldOut: boolean }>
> {
  const { data, error } = await getDb()
    .from("ads")
    .select("channels")
    .eq("status", "active");
  if (error) throw error;
  const used: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const ch of (row.channels as string[]) ?? []) used[ch] = (used[ch] ?? 0) + 1;
  }
  const out = {} as Record<ChannelKey, { used: number; cap: number; soldOut: boolean }>;
  for (const c of AD_CHANNELS) {
    const n = used[c.key] ?? 0;
    out[c.key] = { used: n, cap: c.cap, soldOut: n >= c.cap };
  }
  return out;
}

/** Active, non-expired ads running in a channel. */
async function liveAdsInChannel(channel: ChannelKey): Promise<Ad[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await getDb()
    .from("ads")
    .select("*")
    .eq("status", "active")
    .contains("channels", [channel]);
  if (error) throw error;
  return ((data ?? []) as Ad[]).filter((a) => !a.expires_at || a.expires_at > nowIso);
}

/** Current approved creatives for a set of ad ids, keyed by ad id. */
async function currentApprovedCreatives(adIds: number[]): Promise<Map<number, AdCreative>> {
  if (adIds.length === 0) return new Map();
  const { data, error } = await getDb()
    .from("ad_creatives")
    .select("*")
    .in("ad_id", adIds)
    .eq("is_current", true)
    .eq("approval_status", "approved");
  if (error) throw error;
  const map = new Map<number, AdCreative>();
  for (const c of (data ?? []) as AdCreative[]) map.set(c.ad_id, c);
  return map;
}

function pickRandom<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

/** Choose a job-page ad to show for a given listing (random rotation). */
export async function pickJobPageAd(
  state: string,
  category: string
): Promise<ServableAd | null> {
  const ads = (await liveAdsInChannel("job_pages")).filter(
    (a) =>
      (!a.target_state || a.target_state === state) &&
      (!a.target_category || a.target_category === category)
  );
  const creatives = await currentApprovedCreatives(ads.map((a) => a.id));
  const eligible = ads.filter((a) => creatives.has(a.id));
  const chosen = pickRandom(eligible);
  if (!chosen) return null;
  const cr = creatives.get(chosen.id)!;
  return { adId: chosen.id, creativeId: cr.id, imageUrl: cr.image_url, targetUrl: cr.target_url };
}

/** Choose an email-alert sponsor (random rotation). */
export async function pickEmailAd(): Promise<ServableAd | null> {
  const ads = await liveAdsInChannel("email_alerts");
  const creatives = await currentApprovedCreatives(ads.map((a) => a.id));
  const eligible = ads.filter((a) => creatives.has(a.id));
  const chosen = pickRandom(eligible);
  if (!chosen) return null;
  const cr = creatives.get(chosen.id)!;
  return { adId: chosen.id, creativeId: cr.id, imageUrl: cr.image_url, targetUrl: cr.target_url };
}

export interface AdStats {
  impressions: number;
  clicks: number;
  impressions30d: number;
  clicks30d: number;
}

export async function getAdStats(adId: number): Promise<AdStats> {
  const { data, error } = await getDb()
    .from("ad_stats_daily")
    .select("*")
    .eq("ad_id", adId);
  if (error) throw error;
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const s: AdStats = { impressions: 0, clicks: 0, impressions30d: 0, clicks30d: 0 };
  for (const r of (data ?? []) as { day: string; impressions: number; clicks: number }[]) {
    s.impressions += r.impressions;
    s.clicks += r.clicks;
    if (r.day >= cutoff) {
      s.impressions30d += r.impressions;
      s.clicks30d += r.clicks;
    }
  }
  return s;
}

export interface AdvertiserAd {
  ad: Ad;
  creative: AdCreative | null;
  stats: AdStats;
}

export async function getAdvertiserAds(advertiserId: number): Promise<AdvertiserAd[]> {
  const db = getDb();
  const { data: ads, error } = await db
    .from("ads")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const result: AdvertiserAd[] = [];
  for (const ad of (ads ?? []) as Ad[]) {
    const { data: cr } = await db
      .from("ad_creatives")
      .select("*")
      .eq("ad_id", ad.id)
      .eq("is_current", true)
      .maybeSingle();
    result.push({ ad, creative: (cr as AdCreative) ?? null, stats: await getAdStats(ad.id) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------

export interface PendingCreative {
  creative: AdCreative;
  ad: Ad;
  advertiser: Advertiser;
}

export async function listPendingCreatives(): Promise<PendingCreative[]> {
  const db = getDb();
  const { data: creatives, error } = await db
    .from("ad_creatives")
    .select("*")
    .eq("is_current", true)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const out: PendingCreative[] = [];
  for (const cr of (creatives ?? []) as AdCreative[]) {
    const ad = await getAdById(cr.ad_id);
    if (!ad || ad.status === "pending_payment") continue; // not paid yet
    const { data: adv } = await db
      .from("advertisers")
      .select("*")
      .eq("id", ad.advertiser_id)
      .maybeSingle();
    out.push({ creative: cr, ad, advertiser: adv as Advertiser });
  }
  return out;
}

export async function setCreativeApproval(
  creativeId: number,
  status: "approved" | "rejected"
): Promise<void> {
  const { error } = await getDb()
    .from("ad_creatives")
    .update({ approval_status: status })
    .eq("id", creativeId);
  if (error) throw error;
}

export interface ActiveAdRow {
  ad: Ad;
  advertiser: Advertiser;
  stats: AdStats;
}

export async function listActiveAds(): Promise<ActiveAdRow[]> {
  const db = getDb();
  const { data: ads, error } = await db
    .from("ads")
    .select("*")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const out: ActiveAdRow[] = [];
  for (const ad of (ads ?? []) as Ad[]) {
    const { data: adv } = await db
      .from("advertisers")
      .select("*")
      .eq("id", ad.advertiser_id)
      .maybeSingle();
    out.push({ ad, advertiser: adv as Advertiser, stats: await getAdStats(ad.id) });
  }
  return out;
}

/** Approximate monthly recurring revenue from active recurring ads. */
export function mrrCents(rows: ActiveAdRow[]): number {
  return rows
    .filter((r) => r.ad.status === "active" && r.ad.period_type === "recurring")
    .reduce((sum, r) => sum + r.ad.price_cents, 0);
}

/** Upload a banner to the public storage bucket; returns its path + public URL. */
export async function uploadCreativeImage(
  bytes: ArrayBuffer,
  contentType: string,
  ext: string
): Promise<{ path: string; url: string }> {
  const db = getDb();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await db.storage
    .from("ad-creatives")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  const { data } = db.storage.from("ad-creatives").getPublicUrl(path);
  return { path, url: data.publicUrl };
}
