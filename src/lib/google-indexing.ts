import crypto from "node:crypto";
import { siteUrl } from "./email";

/**
 * Google Indexing API (https://developers.google.com/search/apis/indexing-api).
 *
 * The Indexing API is the supported fast path for pages carrying schema.org
 * `JobPosting` markup — which every page under /jobs/[slug] does — letting us
 * tell Google the moment a listing goes live or comes down, instead of waiting
 * for the next organic crawl.
 *
 * Setup (one-time):
 *  1. Create a Google Cloud service account, enable the Indexing API on it.
 *  2. In Google Search Console, add the service account's email as an **Owner**
 *     of the boatyardjobs.com property.
 *  3. Set env vars (the cron + the server both read these):
 *       GOOGLE_INDEXING_CLIENT_EMAIL  – service account email
 *       GOOGLE_INDEXING_PRIVATE_KEY   – its private key (PEM; literal or \n-escaped)
 *
 * Without those vars every function here is a no-op, so it's safe to ship dark.
 *
 * Quota: Google grants ~200 publish calls/day by default. We only notify on
 * deltas (new/changed/removed listings), never the whole board, and stop early
 * on a quota error — so a busy aggregation run degrades gracefully.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

export function isIndexingEnabled(): boolean {
  return !!(
    process.env.GOOGLE_INDEXING_CLIENT_EMAIL && process.env.GOOGLE_INDEXING_PRIVATE_KEY
  );
}

/** Public job-page URL for a slug — the canonical URL Google indexes. */
export function jobIndexUrl(slug: string): string {
  return `${siteUrl()}/jobs/${slug}`;
}

/** PEM key, tolerating env values that store newlines as the literal "\n". */
function privateKey(): string {
  return (process.env.GOOGLE_INDEXING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

const b64url = (input: crypto.BinaryLike): string =>
  Buffer.from(input as Buffer | string).toString("base64url");

// Access tokens are valid ~1h; cache and reuse within a process/run.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: process.env.GOOGLE_INDEXING_CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claims}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), privateKey())
    .toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

export type IndexingType = "URL_UPDATED" | "URL_DELETED";

async function publishOne(token: string, url: string, type: IndexingType): Promise<void> {
  const res = await fetch(PUBLISH_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ url, type }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
}

/**
 * Best-effort: tell Google these job URLs were updated (went live / changed) or
 * deleted (came down). No-op unless configured. Never throws — indexing is a
 * nicety, not part of the request/cron critical path — and stops early on a
 * quota/rate error so one run can't spew failures. Returns how many succeeded.
 */
export async function notifyIndexing(urls: string[], type: IndexingType): Promise<number> {
  const targets = [...new Set(urls)].filter(Boolean);
  if (!isIndexingEnabled() || targets.length === 0) return 0;

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.error("Google Indexing: auth failed, skipping:", err);
    return 0;
  }

  let ok = 0;
  for (const url of targets) {
    try {
      await publishOne(token, url, type);
      ok++;
    } catch (err) {
      const msg = String(err);
      console.error(`Google Indexing: ${type} ${url} failed: ${msg}`);
      if (msg.startsWith("429") || msg.includes("RATE_LIMIT") || msg.toLowerCase().includes("quota")) {
        console.error("Google Indexing: rate/quota limit hit — stopping early this run.");
        break;
      }
    }
  }
  return ok;
}

/** Convenience: notify by slug for a single just-published/updated listing. */
export async function notifyJobLive(slug: string): Promise<void> {
  await notifyIndexing([jobIndexUrl(slug)], "URL_UPDATED");
}
