import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command:
      "rm -f ./data/e2e.db ./data/e2e.db-wal ./data/e2e.db-shm && ATLAS_DB_PATH=./data/e2e.db ATLAS_FORCE_MOCK_AI=1 ATLAS_MOCK_DELAY_MS=200 npm run build && ATLAS_DB_PATH=./data/e2e.db ATLAS_FORCE_MOCK_AI=1 ATLAS_MOCK_DELAY_MS=200 npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
