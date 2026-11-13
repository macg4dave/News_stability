const { defineConfig } = require("@playwright/test");
if (!process.env.E2E_BASE_URL) throw new Error("Use npm run test:e2e to start the isolated containers.");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.cjs",
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [["list"], ["junit", { outputFile: "test-results/e2e.xml" }]],
  use: { baseURL: process.env.E2E_BASE_URL, browserName: "chromium", screenshot: "off", trace: "off" },
});
