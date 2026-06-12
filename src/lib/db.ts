import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase (Postgres) client, server-side only.
 *
 * Key precedence:
 *  - SUPABASE_SERVICE_ROLE_KEY  → full access, bypasses RLS. Use in production
 *    (server components, route handlers, the aggregation cron). Never expose to
 *    the browser.
 *  - SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY → RLS-gated. Enough for the
 *    public paths (read published jobs, submit a pending job, sign up for
 *    alerts, record an apply click); used for local testing.
 *
 * The schema lives in Supabase migrations, not here.
 */
const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(or SUPABASE_PUBLISHABLE_KEY for the public, RLS-gated client)."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
