import { getDb } from "@/lib/db";

/**
 * First-party pageview beacon. The client posts { path, referrer }; we enrich
 * with country (Vercel geo header) and store the referrer host only. Best-effort
 * and silent — analytics must never break a page. Runs server-side (service role).
 */
function referrerHost(referrer: unknown): string | null {
  if (typeof referrer !== "string" || !referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { path, referrer } = await req.json();
    if (typeof path !== "string" || !path || path.length > 512) {
      return new Response(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent") ?? "";
    if (/bot|crawler|spider|crawl|preview|monitor|headless|lighthouse/i.test(ua)) {
      return new Response(null, { status: 204 });
    }

    let host = referrerHost(referrer);
    const self = (req.headers.get("host") ?? "").replace(/^www\./, "");
    if (host && self && host.endsWith(self)) host = null; // ignore internal navigations

    await getDb().from("page_views").insert({
      path,
      referrer: host,
      country: req.headers.get("x-vercel-ip-country") || null,
    });
  } catch {
    // swallow — tracking is best-effort
  }
  return new Response(null, { status: 204 });
}
