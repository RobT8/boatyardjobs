import { getDb } from "./db";

export interface Bucket {
  label: string;
  n: number;
}
export interface ClickedJob {
  title: string;
  company: string;
  n: number;
}
export interface DayPoint {
  day: string;
  n: number;
}

export interface AdminStats {
  subscribers_total: number;
  subscribers_confirmed: number;
  subscribers_pending: number;
  subscribers_by_state: Bucket[];
  subscribers_by_category: Bucket[];
  clicks_total: number;
  clicks_7d: number;
  clicks_30d: number;
  top_clicked_jobs: ClickedJob[];
  pageviews_total: number;
  pageviews_7d: number;
  pageviews_30d: number;
  pageviews_by_day: DayPoint[];
  top_referrers: Bucket[];
  top_countries: Bucket[];
  top_pages: Bucket[];
  jobs_published: number;
  jobs_pending: number;
  jobs_expired: number;
  jobs_by_source: Bucket[];
  jobs_by_category: Bucket[];
  jobs_by_state: Bucket[];
}

/** Single round-trip dashboard stats (see the admin_stats() Postgres function). */
export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await getDb().rpc("admin_stats");
  if (error) throw error;
  return data as AdminStats;
}
