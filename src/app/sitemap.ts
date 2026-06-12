import type { MetadataRoute } from "next";
import { countByState, listJobs } from "@/lib/jobs";
import { ROLE_CATEGORIES, stateSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? "https://boatyardjobs.com";
  const { jobs } = listJobs({ limit: 1000 });

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
    ...countByState().map(({ state }) => ({
      url: `${base}/jobs/state/${stateSlug(state)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...jobs.map((job) => ({
      url: `${base}/jobs/${job.slug}`,
      lastModified: job.posted_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
