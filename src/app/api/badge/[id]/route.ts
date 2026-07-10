import { countEmployerPublishedJobs, getEmployerById } from "@/lib/employers";

export const dynamic = "force-dynamic";

/** XML-escape untrusted text before dropping it into the SVG. */
function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!
  );
}

/** Truncate a company name so it fits the badge. */
function fit(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

/**
 * Renders the "We're Hiring on BoatyardJobs" badge as a self-contained SVG.
 * Navy card, brass accent bar, a small anchor mark, the company name and a live
 * open-roles count. Everything is inline (no external fonts/images) so it renders
 * identically wherever an employer embeds it.
 */
function badgeSvg(company: string, count: number): string {
  const roles = count === 1 ? "1 open role" : `${count} open roles`;
  const name = esc(fit(company));
  const W = 260;
  const H = 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(company)} is hiring on BoatyardJobs">
  <rect width="${W}" height="${H}" rx="10" fill="#102a45"/>
  <rect width="6" height="${H}" rx="3" fill="#f2b705"/>
  <g transform="translate(20,20)" fill="none" stroke="#f2b705" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="6" r="3"/>
    <line x1="16" y1="9" x2="16" y2="32"/>
    <line x1="8" y1="15" x2="24" y2="15"/>
    <path d="M4 22a12 12 0 0 0 24 0"/>
  </g>
  <text x="62" y="26" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5" fill="#f2b705">WE'RE HIRING</text>
  <text x="62" y="44" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${name}</text>
  <text x="62" y="60" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="11" fill="#b5cde4">${esc(roles)} · BoatyardJobs</text>
</svg>`;
}

/**
 * GET /api/badge/[id] → an SVG "We're Hiring" badge for the given employer.
 * Public and cacheable (the count changes at most daily). Employers embed it on
 * their own careers page wrapped in a link back to BoatyardJobs.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employerId = Number(id);

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
  return new Response(badgeSvg(employer.company, count), { headers });
}
