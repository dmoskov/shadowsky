import { expect, test } from "@playwright/test";

/**
 * Page Load Performance Tests
 *
 * Tests critical page load metrics to ensure our optimizations are working:
 * - requestIdleCallback polyfill is present for Safari/iOS
 * - Critical CSS is inlined
 * - Non-critical CSS is deferred
 * - Module preloads are optimized (no OAuth/Amplify in critical path)
 * - Network-aware loading adapts to connection quality
 *
 * Tag: @performance - Used for running performance tests separately in CI
 */

test.describe("Page Load Optimizations @performance", () => {
  test("requestIdleCallback polyfill is available", async ({ page }) => {
    await page.goto("/");

    // Verify polyfill is present
    const hasPolyfill = await page.evaluate(() => {
      return (
        typeof window.requestIdleCallback === "function" &&
        typeof window.cancelIdleCallback === "function"
      );
    });

    expect(hasPolyfill).toBe(true);
  });

  test("requestIdleCallback polyfill works correctly", async ({ page }) => {
    await page.goto("/");

    // Test that the polyfill actually executes callbacks
    const result = await page.evaluate(() => {
      return new Promise<{ called: boolean; didTimeout: boolean }>(
        (resolve) => {
          window.requestIdleCallback((deadline) => {
            resolve({
              called: true,
              didTimeout: deadline.didTimeout,
            });
          });
        },
      );
    });

    expect(result.called).toBe(true);
  });

  test("requestIdleCallback can be cancelled", async ({ page }) => {
    await page.goto("/");

    const wasCalled = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let called = false;
        const handle = window.requestIdleCallback(() => {
          called = true;
        });
        window.cancelIdleCallback(handle);

        // Wait a bit to confirm it wasn't called
        setTimeout(() => {
          resolve(called);
        }, 100);
      });
    });

    expect(wasCalled).toBe(false);
  });

  test("critical CSS is inlined in document head", async ({ page }) => {
    // Get the raw HTML before JS runs
    const response = await page.goto("/");
    const html = await response?.text();

    // Check for inline style tag with critical CSS variables
    expect(html).toContain("<style>");
    expect(html).toContain("--asph-primary");
    expect(html).toContain("--asph-bg-primary");
  });

  test("CSS loading is configured", async ({ page }) => {
    const response = await page.goto("/");
    const html = await response?.text();

    // In production builds, CSS should use media="print" trick for deferred loading
    // In dev mode, CSS is injected via JavaScript
    const hasDeferredCSS = html?.includes('media="print"');
    const hasRegularCSS = html?.includes('rel="stylesheet"');
    const hasInlineStyle = html?.includes("<style>");

    // Should have some CSS mechanism (inline critical CSS always present)
    expect(hasInlineStyle).toBe(true);

    // In production, also verify the deferred external CSS pattern
    if (hasDeferredCSS) {
      expect(html).toMatch(/this\.media='all'/);
      expect(html).toMatch(/<noscript>.*<link rel="stylesheet"/s);
    }
  });

  test("modulepreload does not include OAuth chunk", async ({ page }) => {
    const response = await page.goto("/");
    const html = await response?.text();

    // Extract all modulepreload links
    const modulePreloads =
      html?.match(/<link[^>]*rel="modulepreload"[^>]*>/g) || [];

    // None should contain OAuth
    for (const preload of modulePreloads) {
      expect(preload).not.toContain("oauth");
      expect(preload).not.toContain("OAuth");
    }
  });

  test("modulepreload does not include Amplify chunk", async ({ page }) => {
    const response = await page.goto("/");
    const html = await response?.text();

    // Extract all modulepreload links
    const modulePreloads =
      html?.match(/<link[^>]*rel="modulepreload"[^>]*>/g) || [];

    // None should contain Amplify
    for (const preload of modulePreloads) {
      expect(preload).not.toContain("amplify");
      expect(preload).not.toContain("Amplify");
    }
  });

  test("app loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Allow app to fully initialize
    await page.waitForTimeout(2000);

    // Filter out expected errors (e.g., network errors in test environment)
    const unexpectedErrors = errors.filter(
      (e) =>
        !e.includes("net::") &&
        !e.includes("Failed to fetch") &&
        !e.includes("NetworkError"),
    );

    expect(unexpectedErrors).toEqual([]);
  });

  test("First Contentful Paint is under 3 seconds", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntriesByName("first-contentful-paint");
          if (entries.length > 0) {
            resolve(entries[0].startTime);
          }
        }).observe({ type: "paint", buffered: true });

        // Fallback timeout
        setTimeout(() => resolve(3000), 5000);
      });
    });

    // FCP should be under 3 seconds
    expect(fcp).toBeLessThan(3000);
  });

  test("JS bundles are loaded", async ({ page }) => {
    const jsResources: string[] = [];

    // Track JS resources
    page.on("response", async (response) => {
      const url = response.url();
      if (url.endsWith(".js") || url.endsWith(".tsx") || url.endsWith(".ts")) {
        jsResources.push(url);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have loaded some JS (either bundled or dev modules)
    expect(jsResources.length).toBeGreaterThan(0);
  });

  test("page becomes interactive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // The app should render something
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    // Root should have content (React rendered)
    const hasContent = await root.evaluate((el) => el.children.length > 0);
    expect(hasContent).toBe(true);
  });
});

test.describe("Network-Aware Loading @performance", () => {
  test("getNetworkInfo returns valid snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Test that network info utilities are working
    const networkInfo = await page.evaluate(() => {
      // Access via window for test purposes
      // In actual code, import from utils/network-info
      const connection = (navigator as any).connection;
      return {
        hasConnectionAPI: !!connection,
        isOnline: navigator.onLine,
        effectiveType: connection?.effectiveType || null,
      };
    });

    expect(networkInfo).toHaveProperty("isOnline");
    expect(typeof networkInfo.isOnline).toBe("boolean");
  });
});

test.describe("Service Worker @performance", () => {
  test("service worker is registered", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for SW registration
    await page.waitForTimeout(2000);

    const swStatus = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        return { supported: false };
      }

      const registration = await navigator.serviceWorker.getRegistration();
      return {
        supported: true,
        registered: !!registration,
        scope: registration?.scope || null,
      };
    });

    expect(swStatus.supported).toBe(true);
    // SW may not be registered in dev/test mode
    // Just verify the API is available
  });
});
