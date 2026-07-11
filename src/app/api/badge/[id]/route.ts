import { countEmployerPublishedJobs, getEmployerById } from "@/lib/employers";
import { renderBadge } from "@/lib/badge";

export const dynamic = "force-dynamic";

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

  const count = await countEmployerPublishedJobs(employerId);
  return new Response(renderBadge(style ?? "", employer.company, count), { headers });
}
