import { test, expect } from "@playwright/test";

/**
 * Safely-automatable P0 guards (F12, I6, I4). None of these write data:
 * - the webhook rejects a bad signature BEFORE processing,
 * - the admin gate redirects unauthenticated visitors,
 * - the alerts form rejects an invalid email BEFORE creating any subscription.
 */

test("F12 · Stripe webhook rejects an invalid signature with 400", async ({ request }) => {
  const res = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": "t=0,v1=deadbeef", "content-type": "application/json" },
    data: JSON.stringify({ id: "evt_smoke_test", type: "checkout.session.completed" }),
    failOnStatusCode: false,
  });
  // Must be rejected at signature verification — never 2xx (which would mean a
  // forged event could publish jobs / activate ads for free).
  expect(res.status(), "forged webhook must be rejected").toBe(400);
});

test("I6 · /admin redirects unauthenticated visitors to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("I4 · alerts signup rejects an invalid email without subscribing", async ({ request }) => {
  const res = await request.post("/api/alerts", {
    form: { email: "not-a-valid-email" },
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  // The route redirects to the error page before touching the DB. Accept the
  // redirect (3xx) or a 4xx — anything but a 2xx "success".
  expect(res.status(), "invalid email must not be accepted").toBeLessThan(400);
  expect(res.status()).toBeGreaterThanOrEqual(300);
  const location = res.headers()["location"] ?? "";
  expect(location).toContain("error=invalid-email");
});
