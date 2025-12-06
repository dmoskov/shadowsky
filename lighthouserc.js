/**
 * Lighthouse CI Configuration
 *
 * Enforces Core Web Vitals performance budgets in CI.
 * Thresholds are aligned with src/config/performance-budget.ts
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci
 */
module.exports = {
  ci: {
    collect: {
      // Number of times to run Lighthouse (averages results)
      numberOfRuns: 3,
      // Use the built static files
      staticDistDir: "./dist",
      // URL paths to test (relative to static server)
      url: ["http://localhost/"],
      // Puppeteer settings for consistency
      settings: {
        // Desktop preset for consistent testing
        preset: "desktop",
        // Throttling settings for realistic performance measurement
        throttlingMethod: "simulate",
        // Chrome flags for CI environment
        chromeFlags: "--no-sandbox --headless --disable-gpu",
      },
    },
    assert: {
      // Assertions for performance budgets
      assertions: {
        // Core Web Vitals - these will fail the CI if exceeded

        // INP (Interaction to Next Paint) < 200ms
        // Note: Lighthouse uses TBT (Total Blocking Time) as a proxy for INP
        // TBT should be < 200ms for good INP
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],

        // Additional performance assertions
        "speed-index": ["warn", { maxNumericValue: 3400 }],
        interactive: ["warn", { maxNumericValue: 3800 }],

        // Category score assertions (0-1 scale)
        "categories:performance": ["error", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      // Store results locally (can be changed to LHCI server for historical tracking)
      target: "temporary-public-storage",
    },
  },
};
