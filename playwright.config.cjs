const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  timeout: 20000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "off", screenshot: "off" },
  webServer: {
    command: "python -B -m http.server 4173 --bind 127.0.0.1 --directory web",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
