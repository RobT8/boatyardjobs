import { countEmployerPublishedJobs, getEmployerById } from "@/lib/employers";
import { recordDetectedPlacement } from "@/lib/badge-placements";
import { renderBadge } from "@/lib/badge";
import { siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * The cross-origin page a badge request came from, normalised to origin + path
 * (query/hash dropped). Returns null for same-origin requests — our own pages
 * and the profile-page preview, which aren't employer placements.
 */
function refererPlacement(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  const ours = new Set<string>();
  try {
    ours.add(new URL(req.url).host);
  } catch {
    /* ignore */
  }
  try {
    ours.add(new URL(siteUrl()).host);
  } catch {
    /* ignore */
  }
  try {
    const u = new URL(ref);
    if (ours.has(u.host)) return null;
    const path = `${u.origin}${u.pathname}`.replace(/\/$/, "");
    return path || u.origin;
  } catch {
    return null;
  }
}

/**
 * GET /api/badge/[id]?style=<styleId> → an SVG "We're Hiring" badge for the
 * given employer, in the requested style (defaults to the standard navy badge).
 * Public and cacheable (the count changes at most daily). Employers embed it on
 * their own careers page wrapped in a link back to BoatyardJobs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employerId = Number(id);
  const style = new URL(req.url).searchParams.get("style");

  const headers = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    // Cache at the edge for an hour; the live count only shifts daily.
    "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
  };

  if (!Number.isInteger(employerId) || employerId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const employer = await getEmployerById(employerId);
  if (!employer) {
    return new Response("Not found", { status: 404 });
  }

  // Best-effort: note which external page this badge is embedded on.
  const placement = refererPlacement(req);
  if (placement) {
    try {
      await recordDetectedPlacement(employerId, placement);
    } catch {
      /* logging must never break the image */
    }
  }

  const count = await countEmployerPublishedJobs(employerId);
  return new Response(renderBadge(style ?? "", employer.company, count), { headers });
}
