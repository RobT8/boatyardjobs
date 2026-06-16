import type { MetadataRoute } from "next";
import { countByState, countByStateAndCategory, listJobs } from "@/lib/jobs";
import { ROLE_CATEGORIES, stateSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const ROLE_SLUGS = new Set(ROLE_CATEGORIES.map((r) => r.slug));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "https://boatyardjobs.com";
  const [{ jobs }, states, stateRoleCounts] = await Promise.all([
    listJobs({ limit: 1000 }),
    countByState(),
    countByStateAndCategory(),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/employers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/alerts`, changeFrequency: "monthly", priority: 0.5 },
    ...ROLE_CATEGORIES.map((r) => ({
      url: `${base}/jobs/role/${r.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...states.map(({ state }) => ({
      url: `${base}/jobs/state/${stateSlug(state)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    // state×role landing pages — only those with live inventory, to keep thin
    // (empty) combinations out of the index.
    ...stateRoleCounts
      .filter((c) => c.n > 0 && ROLE_SLUGS.has(c.category))
      .map((c) => ({
        url: `${base}/jobs/state/${stateSlug(c.state)}/${c.category}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    ...jobs.map((job) => ({
      url: `${base}/jobs/${job.slug}`,
      lastModified: job.posted_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
