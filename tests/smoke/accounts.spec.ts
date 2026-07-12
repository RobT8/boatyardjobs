import { test, expect } from "@playwright/test";

/**
 * Alert signup surface (B1/B2) and the employer + advertiser entry points
 * (C1–C5, D1). Read-only: we assert the forms/pages render and are wired to the
 * right endpoints — we do NOT submit, so no accounts, jobs or emails are created.
 */

test("B1/B2 · alerts page renders the signup form wired to /api/alerts", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: /job alerts/i })).toBeVisible();
  const form = page.locator('form[action="/api/alerts"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="email"]')).toBeVisible();
  await expect(form.getByRole("button", { name: /alert/i })).toBeVisible();
});

test("C1–C4 · employer account page renders sign-in", async ({ page }) => {
  const res = await page.goto("/employers/login");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: /employer account/i })).toBeVisible();
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});

test("C5 · post-a-job page renders its entry step", async ({ page }) => {
  const res = await page.goto("/post-a-job");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: /post a job/i })).toBeVisible();
  // Anonymously the page shows the account step (email); once signed in it shows
  // the wizard (job title). Either entry point means the flow rendered.
  const entry = page.locator('input[name="title"], input[type="email"], input[name="email"]');
  await expect(entry.first()).toBeVisible();
});

test("D1 · advertise page renders", async ({ page }) => {
  const res = await page.goto("/advertise");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("A10 · public employers index renders", async ({ page }) => {
  const res = await page.goto("/employers");
  expect(res?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
});
