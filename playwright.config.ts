import { defineConfig, devices } from "@playwright/test";

// ---------------------------------------------------------------------------
// Playwright config — E2E smoke tests for WaterMirror.
//
// 运行方式：
//   1) 本地 dev：                      npm run test:e2e
//      （会自动 `next dev` 起到 3000，再跑 spec）
//   2) 已经在跑 dev 服务，想直接测：    npm run test:e2e -- --reuse
//   3) 针对线上环境：                   E2E_BASE_URL=https://watermirror.droplets.com.cn npm run test:e2e
//
// Playwright 的 spec 文件放在 tests/e2e/，vitest 已经在 vitest.config.ts
// 里把这个目录 exclude 掉，两套框架互不影响。
// ---------------------------------------------------------------------------

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const reuseServer = !!process.env.E2E_BASE_URL || process.argv.includes("--reuse");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start next dev automatically unless the caller points at an external URL.
  ...(reuseServer
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
