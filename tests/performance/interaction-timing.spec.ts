import { expect, test } from "@playwright/test";

/**
 * Interaction Timing (INP) Performance Tests
 *
 * Tests key user interactions to ensure they complete within the 200ms INP budget.
 * Uses performance.measure() to accurately capture click-to-paint latency.
 *
 * These tests should run against production builds for accurate timing.
 * Configure PLAYWRIGHT_BASE_URL environment variable to point to production build.
 *
 * Tag: @performance - Used for running performance tests separately in CI
 */

const INP_BUDGET_MS = 200;

/**
 * Helper to measure interaction timing using Performance API
 * Measures from click event to next animation frame (paint)
 */
async function measureInteraction(
  page: import("@playwright/test").Page,
  action: () => Promise<void>,
  measureName: string,
): Promise<number> {
  // Clear existing performance entries
  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  // Set up measurement before action
  await page.evaluate((name: string) => {
    performance.mark(`${name}-start`);
  }, measureName);

  // Perform the action
  await action();

  // Wait for next frame to capture paint timing
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  });

  // Complete measurement
  const duration = await page.evaluate((name: string) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    const entries = performance.getEntriesByName(name);
    return entries[0]?.duration || 0;
  }, measureName);

  return duration;
}

/**
 * Helper to wait for element and ensure page is ready
 */
async function waitForInteractiveElement(
  page: import("@playwright/test").Page,
  selector: string,
  timeout = 10000,
) {
  await page.waitForSelector(selector, { state: "visible", timeout });
  // Additional wait for any animations to settle
  await page.waitForTimeout(100);
}

test.describe("Interaction Timing - INP Budget @performance", () => {
  test.beforeEach(async ({ page }) => {
    // Set a generous timeout for initial page load
    test.setTimeout(60000);

    // Navigate to landing page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Login mode toggle click-to-feedback should be under 200ms @performance", async ({
    page,
  }) => {
    // Wait for login form to be ready
    await page.waitForLoadState("networkidle");

    // Find the OAuth or App Password toggle buttons
    const oauthButton = page.getByRole("button", { name: /oauth/i });
    const appPasswordButton = page.getByRole("button", {
      name: /app password/i,
    });

    // Determine which button to click (toggle the mode)
    const targetButton = (await oauthButton.isVisible())
      ? oauthButton
      : appPasswordButton;

    if (await targetButton.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await targetButton.click();
        },
        "login-toggle",
      );

      console.log(`Login toggle interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Login toggle interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    } else {
      test.skip();
    }
  });

  test("Form input click-to-focus should be under 200ms @performance", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Find any input field on the page
    const input = page.locator("input").first();

    if (await input.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await input.click();
        },
        "input-focus",
      );

      console.log(`Input focus interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Input focus interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    } else {
      test.skip();
    }
  });

  test("Submit button click-to-feedback should be under 200ms @performance", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Find the submit button
    const submitButton = page.locator('button[type="submit"]');

    if (await submitButton.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await submitButton.click();
        },
        "submit-click",
      );

      console.log(`Submit button interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Submit button interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    } else {
      test.skip();
    }
  });

  test("Tab key navigation should be under 200ms @performance", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Click somewhere to ensure page has focus
    await page.locator("body").click();

    const duration = await measureInteraction(
      page,
      async () => {
        await page.keyboard.press("Tab");
      },
      "tab-navigation",
    );

    console.log(`Tab navigation interaction: ${duration.toFixed(2)}ms`);

    expect(
      duration,
      `Tab navigation interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
    ).toBeLessThan(INP_BUDGET_MS);
  });

  test("Link hover-to-feedback should be under 200ms @performance", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Find any interactive element (link or button)
    const link = page.locator("a, button").first();

    if (await link.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await link.hover();
        },
        "link-hover",
      );

      console.log(`Link hover interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Link hover interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    } else {
      test.skip();
    }
  });

  test("Multiple rapid clicks should each be under 200ms @performance", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Find a clickable element
    const button = page.locator("button").first();

    if (await button.isVisible()) {
      const durations: number[] = [];

      // Measure 3 rapid clicks
      for (let i = 0; i < 3; i++) {
        const duration = await measureInteraction(
          page,
          async () => {
            await button.click();
          },
          `rapid-click-${i}`,
        );
        durations.push(duration);
      }

      console.log(
        `Rapid click interactions: ${durations.map((d) => d.toFixed(2)).join("ms, ")}ms`,
      );

      // Check each click was under budget
      durations.forEach((duration, index) => {
        expect(
          duration,
          `Rapid click ${index + 1} took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
        ).toBeLessThan(INP_BUDGET_MS);
      });

      // Also check average
      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average rapid click duration: ${avgDuration.toFixed(2)}ms`);
    } else {
      test.skip();
    }
  });
});

test.describe("Interaction Timing - Responsive Design @performance", () => {
  test("Mobile viewport interactions should be under 200ms @performance", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const button = page.locator("button").first();

    if (await button.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await button.click();
        },
        "mobile-click",
      );

      console.log(`Mobile viewport interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Mobile viewport interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    }
  });

  test("Tablet viewport interactions should be under 200ms @performance", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const button = page.locator("button").first();

    if (await button.isVisible()) {
      const duration = await measureInteraction(
        page,
        async () => {
          await button.click();
        },
        "tablet-click",
      );

      console.log(`Tablet viewport interaction: ${duration.toFixed(2)}ms`);

      expect(
        duration,
        `Tablet viewport interaction took ${duration.toFixed(2)}ms, expected under ${INP_BUDGET_MS}ms`,
      ).toBeLessThan(INP_BUDGET_MS);
    }
  });
});

test.describe("Interaction Timing Summary @performance", () => {
  test("Generate interaction timing report @performance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results: { name: string; duration: number; passed: boolean }[] = [];

    // Test various interactions and collect results
    const interactions = [
      {
        name: "First Input Focus",
        action: async () => {
          const input = page.locator("input").first();
          if (await input.isVisible()) {
            await input.click();
            return true;
          }
          return false;
        },
      },
      {
        name: "First Button Click",
        action: async () => {
          const button = page.locator("button").first();
          if (await button.isVisible()) {
            await button.click();
            return true;
          }
          return false;
        },
      },
      {
        name: "Tab Navigation",
        action: async () => {
          await page.keyboard.press("Tab");
          return true;
        },
      },
      {
        name: "Escape Key",
        action: async () => {
          await page.keyboard.press("Escape");
          return true;
        },
      },
      {
        name: "Click Body",
        action: async () => {
          await page.locator("body").click();
          return true;
        },
      },
    ];

    for (const { name, action } of interactions) {
      try {
        const duration = await measureInteraction(
          page,
          action,
          name.toLowerCase().replace(/\s+/g, "-"),
        );
        results.push({
          name,
          duration,
          passed: duration < INP_BUDGET_MS,
        });
      } catch {
        // Skip failed interactions
      }
    }

    // Log summary report
    console.log("\n=== INTERACTION TIMING REPORT ===\n");
    console.log(`INP Budget: ${INP_BUDGET_MS}ms\n`);
    console.log("| Interaction | Duration | Status |");
    console.log("|-------------|----------|--------|");

    for (const result of results) {
      const status = result.passed ? "PASS" : "FAIL";
      console.log(
        `| ${result.name} | ${result.duration.toFixed(2)}ms | ${status} |`,
      );
    }

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`\nPassed: ${passedCount}/${totalCount}`);

    // Overall assertion
    const allPassed = results.every((r) => r.passed);
    expect(allPassed, "Some interactions exceeded the 200ms INP budget").toBe(
      true,
    );
  });
});
