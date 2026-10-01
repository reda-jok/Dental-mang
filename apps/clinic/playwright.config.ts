import { defineConfig, devices } from "@playwright/test"

import { E2E_UPLOAD_DIR, e2eDatabaseUrl } from "./e2e/database"

// E2E runs against its own throwaway database so it never touches dev data.
const PORT = 3200
const DATABASE_URL = e2eDatabaseUrl()

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The e2e server is `next dev`, which compiles each page/action on first use; on a busy
  // machine (e.g. another dev server running) that first hit can take several seconds.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ar-IQ",
    timezoneId: "Asia/Baghdad",
    trace: "retain-on-failure",
  },
  projects: [
    // First-run clinic setup happens once; everything else depends on it.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "phone", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `next dev --port ${PORT}`, // direct, so Playwright can stop it cleanly
    // Liveness only: the database is created by globalSetup, which runs after this.
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-e2e-0000",
      NEXT_DIST_DIR: ".next-e2e",
      UPLOAD_DIR: E2E_UPLOAD_DIR,
      AUTH_RATE_LIMIT: "off", // many logins per minute across tests; rate limiting is checked separately
    },
  },
})
