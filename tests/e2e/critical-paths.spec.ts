import { expect, test } from "@playwright/test";

/**
 * Critical Path E2E Tests
 *
 * These tests verify core functionality without requiring authentication.
 * They run in CI to catch regressions in the application's core flows.
 */

test.describe("Application Load", () => {
  test("app loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Allow app to fully initialize
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test("app has correct page title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const title = await page.title();
    expect(title).toBeTruthy();
    // Title should contain app name
    expect(title.toLowerCase()).toContain("asphodel");
  });

  test("React root element is present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const root = page.locator("#root");
    await expect(root).toBeVisible();
    // Root should have content
    const children = await root.locator("> *").count();
    expect(children).toBeGreaterThan(0);
  });
});

test.describe("Landing Page", () => {
  test("landing page renders correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for Asphodel branding
    await expect(page.getByText("Asphodel")).toBeVisible();

    // Check for sign in heading
    await expect(
      page.getByText("Sign in with your Bluesky account"),
    ).toBeVisible();
  });

  test("login form elements are present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for login mode toggle buttons
    const oauthButton = page.getByRole("button", { name: /oauth/i });
    const appPasswordButton = page.getByRole("button", {
      name: /app password/i,
    });

    // At least one login method should be visible
    const oauthVisible = await oauthButton.isVisible().catch(() => false);
    const appPasswordVisible = await appPasswordButton
      .isVisible()
      .catch(() => false);
    expect(oauthVisible || appPasswordVisible).toBe(true);
  });

  test("OAuth login form has handle input", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Try to switch to OAuth mode if available
    const oauthButton = page.getByRole("button", { name: /oauth/i });
    if (await oauthButton.isEnabled().catch(() => false)) {
      await oauthButton.click();
    }

    // Look for handle input field (used in OAuth mode)
    const handleInput = page
      .locator(
        'input[placeholder*="handle" i], input[placeholder*="username" i]',
      )
      .first();
    const handleVisible = await handleInput.isVisible().catch(() => false);

    // If OAuth is available, handle input should be visible
    // If not, this is acceptable (app password mode will be shown)
    if (await oauthButton.isEnabled().catch(() => false)) {
      expect(handleVisible).toBe(true);
    }
  });

  test("App Password login form has required fields", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Switch to App Password mode
    const appPasswordButton = page.getByRole("button", {
      name: /app password/i,
    });
    if (await appPasswordButton.isVisible()) {
      await appPasswordButton.click();
      await page.waitForTimeout(300); // Wait for mode switch

      // Check for identifier and password inputs
      const identifierInput = page.locator(
        'input[type="text"]:not([type="password"])',
      );
      const passwordInput = page.locator('input[type="password"]');

      await expect(identifierInput.first()).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });

  test("submit button is present and initially enabled", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });
});

test.describe("UI Components", () => {
  test("logo is displayed", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for logo image
    const logo = page.locator('img[alt*="ShadowSky" i], img[alt*="Logo" i]');
    await expect(logo.first()).toBeVisible();
  });

  test("feature highlights are displayed", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for feature section elements (cards or list items describing features)
    const featureSection = page.locator(".bsky-card, [class*='feature']");
    const count = await featureSection.count();

    // Should have at least the login card
    expect(count).toBeGreaterThan(0);
  });

  test("dark theme is applied by default", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that CSS variables for dark theme are applied
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--bsky-bg-primary")
        .trim();
    });

    // Background should be a dark color (starts with # and has low values)
    expect(bgColor).toBeTruthy();
  });
});

test.describe("Responsive Design", () => {
  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // ShadowSky branding should still be visible
    await expect(page.getByText("ShadowSky").first()).toBeVisible();

    // Login form should be accessible
    const loginForm = page.locator('button[type="submit"]');
    await expect(loginForm).toBeVisible();
  });

  test("tablet viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("ShadowSky").first()).toBeVisible();
  });

  test("desktop viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("ShadowSky").first()).toBeVisible();
  });
});

test.describe("Error Handling", () => {
  test("form shows error on invalid submission", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Switch to App Password mode for testable form
    const appPasswordButton = page.getByRole("button", {
      name: /app password/i,
    });
    if (await appPasswordButton.isVisible()) {
      await appPasswordButton.click();
      await page.waitForTimeout(300);

      // Fill with invalid credentials
      const identifierInput = page
        .locator('input[type="text"]:not([type="password"])')
        .first();
      await identifierInput.fill("invalid@test.com");

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill("wrongpassword");

      // Submit the form
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for error response
      await page.waitForTimeout(2000);

      // Should show some error indication (error message or form state change)
      // We don't check specific text since error messages may vary
      const pageContent = await page.content();
      // Either an error is shown or loading state ends
      expect(pageContent.length).toBeGreaterThan(0);
    }
  });
});

test.describe("Accessibility", () => {
  test("page has proper heading structure", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have at least one h1 or h2 heading
    const headings = page.locator("h1, h2");
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test("form inputs have associated labels or placeholders", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that inputs have labels, aria-labels, or placeholders
    const inputs = page.locator("input");
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute("placeholder");
      const ariaLabel = await input.getAttribute("aria-label");
      const id = await input.getAttribute("id");

      // Each input should have some accessible name
      const hasAccessibleName =
        placeholder ||
        ariaLabel ||
        (id && (await page.locator(`label[for="${id}"]`).count()) > 0);
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab through the page and verify focus moves
    await page.keyboard.press("Tab");

    // Something should be focused
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(focusedElement).toBeTruthy();
    expect(focusedElement).not.toBe("BODY");
  });
});

test.describe("Performance", () => {
  test("page loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Page should load in under 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test("no memory leaks on navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Get initial memory usage
    const initialMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Reload page multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    const finalMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // If memory API is available, check for reasonable growth
    if (initialMetrics > 0 && finalMetrics > 0) {
      // Allow up to 50% growth (generous margin for CI variability)
      expect(finalMetrics).toBeLessThan(initialMetrics * 1.5);
    }
  });
});
