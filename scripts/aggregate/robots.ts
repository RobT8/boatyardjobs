/**
 * Minimal robots.txt support for the aggregation crawlers.
 *
 * Why: our crawler ground rules (see types.ts) say to respect robots.txt, but
 * the adapters never actually consulted it. This adds that — before we fetch an
 * employer/ATS page we check the site's posted rules and stay out of paths it
 * asks crawlers to avoid.
 *
 * Behavior:
 *  - One parsed result is cached per origin for the life of a run.
 *  - Fail-open: a missing / unreachable / unparseable robots.txt means "allowed"
 *    (standard crawler behavior, and it keeps a transient fetch error from
 *    silently skipping — and thus expiring — a whole source).
 *  - Honors the most specific matching User-agent group (our token, else `*`)
 *    with longest-match Allow/Disallow precedence (Allow wins on a tie).
 *  - Supports `*` wildcards and `$` end-anchors in rule paths.
 *
 * NOTE: robots.txt governs *crawling*. It does NOT govern access to a licensed
 * data API we're authorized to call (e.g. Adzuna, whose robots.txt disallows
 * everything yet whose Jobs API we hold a key for) — those adapters intentionally
 * do not call this.
 */

// Mirrors USER_AGENT in types.ts (kept local to avoid an import cycle).
const UA_HEADER = "BoatyardJobsBot/0.1 (+https://boatyardjobs.com/about-our-crawler)";
// Our product token, lowercased, for matching robots `User-agent:` lines.
const UA_TOKEN = "boatyardjobsbot";

export interface RobotsRules {
  rules: { allow: boolean; pattern: string }[];
}

const EMPTY: RobotsRules = { rules: [] };
const cache = new Map<string, Promise<RobotsRules>>();

/** Parse robots.txt text into the rule set that applies to *our* crawler. */
export function parseRobots(txt: string): RobotsRules {
  interface Group {
    agents: string[];
    rules: { allow: boolean; pattern: string }[];
  }
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (let raw of txt.split(/\r?\n/)) {
    const hash = raw.indexOf("#");
    if (hash !== -1) raw = raw.slice(0, hash);
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group; otherwise start a new one.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      // An empty Disallow imposes no restriction — drop it (default is allow).
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
      lastWasAgent = false;
    } else {
      // sitemap, crawl-delay, host, … — not enforced here.
      lastWasAgent = false;
    }
  }

  // Prefer a group naming our token; fall back to the wildcard group.
  let selected = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && UA_TOKEN.includes(a))
  );
  if (selected.length === 0) selected = groups.filter((g) => g.agents.includes("*"));
  return { rules: selected.flatMap((g) => g.rules) };
}

function matchPattern(pattern: string, path: string): boolean {
  let p = pattern;
  let anchorEnd = false;
  if (p.endsWith("$")) {
    anchorEnd = true;
    p = p.slice(0, -1);
  }
  const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + (anchorEnd ? "$" : "")).test(path);
}

/** Is `path` (pathname + search) allowed by a parsed rule set? */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules.rules) {
    if (!matchPattern(r.pattern, path)) continue;
    const len = r.pattern.length;
    if (!best || len > best.len || (len === best.len && r.allow)) {
      best = { allow: r.allow, len };
    }
  }
  return best ? best.allow : true;
}

async function fetchRules(origin: string): Promise<RobotsRules> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA_HEADER },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return EMPTY; // 404 / 5xx → allow all
    return parseRobots(await res.text());
  } catch {
    return EMPTY; // unreachable / aborted → fail open
  }
}

function rulesFor(origin: string): Promise<RobotsRules> {
  let cached = cache.get(origin);
  if (!cached) {
    cached = fetchRules(origin);
    cache.set(origin, cached);
  }
  return cached;
}

/** Whether our crawler may fetch `url`, per the site's robots.txt. */
export async function isAllowed(url: string): Promise<boolean> {
  let origin: string;
  let path: string;
  try {
    const u = new URL(url);
    origin = u.origin;
    path = u.pathname + u.search;
  } catch {
    return true; // not a real URL we can reason about — don't block
  }
  return isPathAllowed(await rulesFor(origin), path);
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows crawling ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

/** Throw if `url` is disallowed — use to fail a source fast and skip it. */
export async function assertCrawlable(url: string): Promise<void> {
  if (!(await isAllowed(url))) throw new RobotsDisallowedError(url);
}
