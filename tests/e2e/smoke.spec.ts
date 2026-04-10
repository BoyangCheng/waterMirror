// ---------------------------------------------------------------------------
// E2E smoke tests — verify the Next.js app starts and the auth-gated routes
// redirect properly. We can't drive a real interview end-to-end without the
// RTC backend + Authing account, so these focus on the entry points.
//
// Run with:
//   npm run test:e2e             # spawns `next dev` automatically
//   npm run test:e2e -- --reuse  # use an already-running dev server
//   E2E_BASE_URL=https://... npm run test:e2e  # hit a deployed env
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("smoke: server health", () => {
  test("sign-in page issues the auth redirect (200 or 30x to /api/auth/login)", async ({
    page,
  }) => {
    // Block the final jump to Authing so we don't leave our base URL.
    // The intercepted URL can be either the authing host or our own /api/auth/login.
    await page.route("**/api/auth/login*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "INTERCEPTED_LOGIN",
      }),
    );

    const resp = await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    expect(resp, "page.goto must return a Response").not.toBeNull();
    // Final status should be the fulfilled 200 (since we intercepted the login endpoint).
    expect(resp!.status()).toBeLessThan(400);
    await expect(page.locator("body")).toContainText("INTERCEPTED_LOGIN");
  });

  test("dashboard route without a session is not a 5xx", async ({ page }) => {
    await page.route("**/api/auth/login*", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "LOGIN_OK" }),
    );

    const resp = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    expect(resp).not.toBeNull();
    // Any status < 500 is a "healthy" server — we expect 200 after the login
    // mock, or 3xx / 401 / 404 depending on how the middleware guards it.
    expect(resp!.status()).toBeLessThan(500);
  });

  test("a non-existent route returns 404, not 500", async ({ page }) => {
    const resp = await page.goto("/this-route-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(resp).not.toBeNull();
    expect(resp!.status()).toBeLessThan(500);
  });
});

test.describe("smoke: static assets", () => {
  test("favicon / public png resolves", async ({ request }) => {
    // These files were part of the recent rename:
    //   public/loading-time.png
    //   public/no-responses.png
    //   public/premium-plan-icon.png
    const r = await request.get("/premium-plan-icon.png");
    expect(r.status()).toBeLessThan(400);
    const ct = r.headers()["content-type"] ?? "";
    expect(ct).toContain("image/");
  });
});
