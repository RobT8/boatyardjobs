import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-suite config. These tests run against a **live URL** (production or a
 * Vercel preview) — there is no local webServer, because the app needs Supabase
 * env to render DB-backed pages. Point them with SMOKE_BASE_URL:
 *
 *   SMOKE_BASE_URL=https://www.boatyardjobs.com npm run smoke
 *
 * They are **read-only** by default (no accounts created, no payments, no data
 * written), so they're safe to run against production. See tests/smoke/README.md.
 */
const baseURL = (process.env.SMOKE_BASE_URL ?? "https://www.boatyardjobs.com").replace(/\/$/, "");

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["json", { outputFile: "smoke-results.json" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Honour the pre-installed Chromium in this environment when present; in CI
    // the standard `playwright install chromium` provides its own binary.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
