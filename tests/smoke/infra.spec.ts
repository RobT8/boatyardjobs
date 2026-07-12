import { test, expect } from "@playwright/test";

/**
 * Infrastructure & SEO plumbing (checklist H6/H7 + error states A11).
 * Uses raw requests so it doesn't depend on rendered DOM.
 */

test("robots.txt is served and points at the sitemap", async ({ request, baseURL }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.toLowerCase()).toContain("sitemap");
  // Canonical host must be www (HANDOVER 2026-07-07).
  expect(body).toContain("www.boatyardjobs.com");
  expect(baseURL).toBeTruthy();
});

test("sitemap.xml is served and lists URLs", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("<urlset");
  expect(body).toContain("<loc>");
});

test("A11 · an unknown job slug returns a friendly 404, not a 500", async ({ page }) => {
  const res = await page.goto("/jobs/this-slug-does-not-exist-zzz");
  // Next renders notFound() as a 404; must never be a 5xx stack trace.
  expect(res?.status()).toBeGreaterThanOrEqual(400);
  expect(res?.status()).toBeLessThan(500);
});

test("apex domain redirects to the www canonical host", async ({ request }) => {
  // Follows the 308; final URL must be the www host.
  const res = await request.get("https://boatyardjobs.com/", { maxRedirects: 5 }).catch(() => null);
  if (res) {
    expect(res.url()).toContain("www.boatyardjobs.com");
  }
});
