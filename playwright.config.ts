import { defineConfig, devices } from "@playwright/test";

// Performance tests should run against production build for accurate timing
const isPerformanceTest = process.env.PERFORMANCE_TEST === "true";

// Both dev and preview servers run on port 5174 (configured in vite.config.ts)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests",
  testMatch: isPerformanceTest
    ? ["performance/**/*.spec.ts"]
    : ["e2e/**/*.spec.ts", "visual-regression*.spec.ts"],
  timeout: 60 * 1000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Set explicit viewport for consistent visual regression tests across platforms
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    // Performance tests should use production build (npm run preview)
    // Regular tests use development server for faster iteration
    command: isPerformanceTest ? "npm run preview" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
