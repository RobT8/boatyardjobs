/**
 * "We're Hiring on BoatyardJobs" badge — SVG renderer + the catalogue of styles
 * employers can choose from. Pure (no I/O) so it's shared by the image route
 * (`/api/badge/[id]`) and the embed UI on the employer profile.
 *
 * Every style is a self-contained SVG (no external fonts/images) drawn from the
 * brand palette: navy #102a45, brass #f2b705, navy-600 #1d4e7a, light-blue
 * #b5cde4. Two families — full (with company name) and compact/mini (count only,
 * for employers who want something small) — each in a navy and a light theme.
 */

export interface BadgeStyle {
  id: string;
  /** Human label for the picker. */
  label: string;
  /** A one-line hint shown under the label. */
  hint: string;
  /** Intrinsic pixel size — also the width/height the embed <img> uses. */
  w: number;
  h: number;
}

export const BADGE_STYLES: BadgeStyle[] = [
  { id: "navy", label: "Standard · Navy", hint: "Company name + live count", w: 260, h: 72 },
  { id: "light", label: "Standard · Light", hint: "For dark-coloured sites", w: 260, h: 72 },
  { id: "compact", label: "Compact · Navy", hint: "Smaller, count only", w: 200, h: 46 },
  { id: "compact-light", label: "Compact · Light", hint: "Smaller, light theme", w: 200, h: 46 },
  { id: "mini", label: "Mini", hint: "Smallest — a single line", w: 176, h: 34 },
];

export const DEFAULT_BADGE_STYLE = "navy";

export function isBadgeStyle(id: string | null | undefined): id is string {
  return !!id && BADGE_STYLES.some((s) => s.id === id);
}

export function badgeStyle(id: string | null | undefined): BadgeStyle {
  return BADGE_STYLES.find((s) => s.id === id) ?? BADGE_STYLES[0];
}

/** XML-escape untrusted text before dropping it into the SVG. */
function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!
  );
}

/** Truncate a company name so it fits the full-size badge. */
function fit(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

const FONT = "Segoe UI, Helvetica, Arial, sans-serif";

/** Anchor mark, scaled and coloured, positioned via translate. */
function anchor(x: number, y: number, scale: number, stroke: string, sw: number): string {
  return `<g transform="translate(${x},${y}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="6" r="3"/><line x1="16" y1="9" x2="16" y2="32"/><line x1="8" y1="15" x2="24" y2="15"/><path d="M4 22a12 12 0 0 0 24 0"/></g>`;
}

/**
 * Render one badge style to an SVG string for the given company + live count.
 * Unknown styles fall back to the default.
 */
export function renderBadge(styleId: string, company: string, count: number): string {
  const style = badgeStyle(styleId).id;

  // Full styles ---------------------------------------------------------------
  if (style === "navy" || style === "light") {
    const light = style === "light";
    const bg = light ? "#ffffff" : "#102a45";
    const border = light ? ' stroke="#dae6f2"' : "";
    const anchorColor = light ? "#d99e02" : "#f2b705";
    const kicker = light ? "#1d4e7a" : "#f2b705";
    const nameColor = light ? "#102a45" : "#ffffff";
    const subColor = light ? "#5c6a7a" : "#b5cde4";
    const roles = count === 1 ? "1 open role" : `${count} open roles`;
    const name = esc(fit(company));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="72" viewBox="0 0 260 72" role="img" aria-label="${esc(company)} is hiring on BoatyardJobs">
  <rect x="0.5" y="0.5" width="259" height="71" rx="10" fill="${bg}"${border}/>
  <rect width="6" height="72" rx="3" fill="#f2b705"/>
  ${anchor(20, 20, 1, anchorColor, 2.4)}
  <text x="62" y="26" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="1.5" fill="${kicker}">WE'RE HIRING</text>
  <text x="62" y="44" font-family="${FONT}" font-size="14" font-weight="700" fill="${nameColor}">${name}</text>
  <text x="62" y="60" font-family="${FONT}" font-size="11" fill="${subColor}">${esc(roles)} · BoatyardJobs</text>
</svg>`;
  }

  // Compact styles ------------------------------------------------------------
  if (style === "compact" || style === "compact-light") {
    const light = style === "compact-light";
    const bg = light ? "#ffffff" : "#102a45";
    const border = light ? ' stroke="#dae6f2"' : "";
    const anchorColor = light ? "#d99e02" : "#f2b705";
    const kicker = light ? "#1d4e7a" : "#f2b705";
    const subColor = light ? "#5c6a7a" : "#b5cde4";
    const roles = count === 1 ? "1 role" : `${count} roles`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="46" viewBox="0 0 200 46" role="img" aria-label="Hiring on BoatyardJobs — ${esc(roles)}">
  <rect x="0.5" y="0.5" width="199" height="45" rx="8" fill="${bg}"${border}/>
  <rect width="5" height="46" rx="2.5" fill="#f2b705"/>
  ${anchor(14, 11, 0.62, anchorColor, 3.4)}
  <text x="44" y="20" font-family="${FONT}" font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${kicker}">WE'RE HIRING</text>
  <text x="44" y="34" font-family="${FONT}" font-size="10.5" fill="${subColor}">${esc(roles)} · BoatyardJobs</text>
</svg>`;
  }

  // Mini ----------------------------------------------------------------------
  const roles = count === 1 ? "1 role" : `${count} roles`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="34" viewBox="0 0 176 34" role="img" aria-label="Hiring on BoatyardJobs — ${esc(roles)}">
  <rect width="176" height="34" rx="7" fill="#102a45"/>
  ${anchor(11, 7, 0.5, "#f2b705", 4)}
  <text x="36" y="22" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">We're hiring <tspan fill="#f2b705">· ${esc(roles)}</tspan></text>
</svg>`;
}
