import { test, expect } from "@playwright/test";

/**
 * Candidate / job-seeker journey (checklist A1–A8) + structured data (H1).
 * All read-only against the live site.
 */

test("A1 · home page loads with hero, search and a route into the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  // Search form is the primary demand-side entry point.
  await expect(page.locator("form").first()).toBeVisible();
  // A link into the job board must exist.
  await expect(page.locator('a[href="/jobs"], a[href^="/jobs?"]').first()).toBeVisible();
});

test("A2 · job board lists jobs and never crashes on the featured section", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: /marine trades jobs/i })).toBeVisible();
  const jobLinks = page.locator('a[href^="/jobs/"]:not([href="/jobs"])');
  // Either there is live inventory (links present) or the explicit empty state.
  const count = await jobLinks.count();
  if (count === 0) {
    await expect(page.getByText(/no jobs match/i)).toBeVisible();
  } else {
    expect(count).toBeGreaterThan(0);
  }
});

test("A3 · search by state returns a coherent board (results or empty state)", async ({ page }) => {
  await page.goto("/jobs?state=FL");
  await expect(page.getByRole("heading", { name: /marine trades jobs/i })).toBeVisible();
  // Must not 500; the page renders either results or the empty message.
  const hasResults = (await page.locator('a[href^="/jobs/"]:not([href="/jobs"])').count()) > 0;
  const hasEmpty = await page.getByText(/no jobs match/i).isVisible().catch(() => false);
  expect(hasResults || hasEmpty).toBeTruthy();
});

test("A4/A5 · a job detail page renders and exposes a tracked Apply link", async ({ page }) => {
  await page.goto("/jobs");
  const firstJob = page.locator('a[href^="/jobs/"]:not([href="/jobs"])').first();
  test.skip((await firstJob.count()) === 0, "no live jobs to open");
  await firstJob.click();
  await expect(page).toHaveURL(/\/jobs\/.+/);
  await expect(page.locator("h1").first()).toBeVisible();
  // A5: Apply routes through the tracking endpoint /api/jobs/<id>/apply.
  const apply = page.locator('a[href^="/api/jobs/"][href$="/apply"]');
  await expect(apply.first()).toBeVisible();
  await expect(apply.first()).toContainText(/apply/i);
});

test("A8 · salary landing page renders", async ({ page }) => {
  const res = await page.goto("/salary");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("H1 · a live JobPosting page emits valid, dated JSON-LD", async ({ page }) => {
  await page.goto("/jobs");
  const firstJob = page.locator('a[href^="/jobs/"]:not([href="/jobs"])').first();
  test.skip((await firstJob.count()) === 0, "no live jobs to validate");
  const href = await firstJob.getAttribute("href");
  await page.goto(href!);
  // The page has several JSON-LD blocks (the layout emits Organization + WebSite);
  // pick the JobPosting one specifically rather than assuming it's first.
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const data = blocks
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .find((d) => d && d["@type"] === "JobPosting");
  expect(data, "a JobPosting JSON-LD block must be present").toBeTruthy();
  expect(data.title, "JobPosting.title").toBeTruthy();
  expect(data.hiringOrganization, "hiringOrganization").toBeTruthy();
  // The 2026-06-25 fix: validThrough must always be present (feed jobs fall back
  // to the age-cap bound), or Google downgrades the rich result.
  expect(data.validThrough, "validThrough must always be emitted").toBeTruthy();
});
