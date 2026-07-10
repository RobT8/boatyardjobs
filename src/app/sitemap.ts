import type { MetadataRoute } from "next";
import { listEmployerIdsWithPublishedJobs } from "@/lib/employers";
import {
  countByCity,
  countByCityAndCategory,
  countByState,
  countByStateAndCategory,
  listJobs,
} from "@/lib/jobs";
import { statesWithSalary } from "@/lib/salary";
import { citySlug, ROLE_CATEGORIES, stateSlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const ROLE_SLUGS = new Set(ROLE_CATEGORIES.map((r) => r.slug));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Canonical host is www — the apex 308s to it, and Google treats redirected
  // sitemap/ping URLs as second-class. Keep SITE_URL (and this fallback) on www.
  const base = process.env.SITE_URL ?? "https://www.boatyardjobs.com";
  const [{ jobs }, states, stateRoleCounts, cities, cityRoleCounts, salaryStates, employerIds] =
    await Promise.all([
      listJobs({ limit: 1000 }),
      countByState(),
      countByStateAndCategory(),
      countByCity(),
      countByCityAndCategory(),
      // For each role, the states with enough salaried inventory for a credible page.
      Promise.all(
        ROLE_CATEGORIES.map(async (r) => ({
          role: r.slug,
          states: await statesWithSalary(r.slug),
        }))
      ),
      listEmployerIdsWithPublishedJobs(),
    ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/employers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/advertise`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/advertise/guidelines`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/alerts`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/certifications`, changeFrequency: "monthly", priority: 0.6 },
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
    // City landing pages — one per city with live inventory.
    ...cities.map((c) => ({
      url: `${base}/jobs/city/${stateSlug(c.state)}/${citySlug(c.city)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
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
    // role×city landing pages — one per (city, role) with live inventory, the
    // long-tail set that targets low-competition "<role> jobs <city>" intent.
    // Filtered to real inventory + known roles to keep thin combinations out.
    ...cityRoleCounts
      .filter((c) => c.n > 0 && ROLE_SLUGS.has(c.category))
      .map((c) => ({
        url: `${base}/jobs/city/${stateSlug(c.state)}/${citySlug(c.city)}/${c.category}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    // Salary guides: the hub, one per role, and role×state where the sample is
    // big enough to publish a credible figure.
    { url: `${base}/salary`, changeFrequency: "weekly" as const, priority: 0.6 },
    ...ROLE_CATEGORIES.map((r) => ({
      url: `${base}/salary/${r.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...salaryStates.flatMap(({ role, states: ss }) =>
      ss.map((s) => ({
        url: `${base}/salary/${role}/${stateSlug(s.state)}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }))
    ),
    ...jobs.map((job) => ({
      url: `${base}/jobs/${job.slug}`,
      lastModified: job.posted_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Public employer pages — the "We're Hiring" badge backlink targets. Only
    // those with live listings (the page 404s otherwise).
    ...employerIds.map((id) => ({
      url: `${base}/employers/${id}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
