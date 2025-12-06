import { expect, test } from "@playwright/test";

// Test configuration
const TEST_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

// Configuration for visual regression tests
const VISUAL_CONFIG = {
  fullPage: true,
  animations: "disabled" as const,
};

// Check if credentials are available
function hasCredentials() {
  const identifier = process.env.TEST_USER || process.env.VITE_TEST_IDENTIFIER || "";
  const password = process.env.TEST_PASS || process.env.VITE_TEST_PASSWORD || "";
  return !!(identifier && password);
}

// Helper to get credentials from environment variables
function getCredentials() {
  const identifier = process.env.TEST_USER || process.env.VITE_TEST_IDENTIFIER || "";
  const password = process.env.TEST_PASS || process.env.VITE_TEST_PASSWORD || "";

  if (!identifier || !password) {
    throw new Error(
      "Test credentials not configured. Set TEST_USER and TEST_PASS environment variables.",
    );
  }

  return { identifier, password };
}

// Helper to login
async function login(page: any) {
  const { identifier, password } = getCredentials();
  // Wait for the login form to be visible
  await page.waitForSelector('input[placeholder*="handle" i], input[placeholder*="Username" i], input[placeholder*="email" i]', { timeout: 10000 });

  // Fill in credentials - try different input selectors
  const handleInput = page.locator('input[placeholder*="handle" i], input[placeholder*="Username" i]').first();
  await handleInput.fill(identifier);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000); // Let content load
}

test.describe("Visual Regression Baseline - Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
  });

  test("01 - Landing Page", async ({ page }) => {
    await expect(page).toHaveScreenshot("01-login-page.png", VISUAL_CONFIG);
  });

  test("14 - Loading States", async ({ page }) => {
    // Navigate without waiting for full network idle to capture loading state
    await page.goto(TEST_URL);
    await expect(page).toHaveScreenshot("14-loading-skeleton.png", VISUAL_CONFIG);
  });
});

test.describe("Visual Regression Baseline - Authenticated", () => {
  test.skip(!hasCredentials(), "Requires test credentials");

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await login(page);
  });

  test("02 - Feed View", async ({ page }) => {
    await page.waitForTimeout(2000); // Let feed stabilize
    await expect(page).toHaveScreenshot("02-feed-view.png", VISUAL_CONFIG);
  });

  test("03 - Post Interactions", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Take full page screenshot for post interaction context
    await expect(page).toHaveScreenshot("03-post-hover.png", VISUAL_CONFIG);
  });

  test("08 - Profile Page", async ({ page }) => {
    // Navigate to profile via URL
    await page.goto(`${TEST_URL}/profile`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("08-profile-page.png", VISUAL_CONFIG);
  });

  test("09 - Settings Page", async ({ page }) => {
    await page.goto(`${TEST_URL}/settings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("09-settings-page.png", VISUAL_CONFIG);
  });

  test("11 - Mobile Viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("11-mobile-feed.png", VISUAL_CONFIG);
  });

  test("12 - Tablet Viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("12-tablet-feed.png", VISUAL_CONFIG);
  });
});

test.describe("Visual Regression Baseline - Error States", () => {
  test("13 - Error States", async ({ page }) => {
    // Force an error by going to a bad route
    await page.goto(`${TEST_URL}/nonexistent-route-for-testing`);
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("13-error-state.png", VISUAL_CONFIG);
  });
});

// Component-specific detail tests
test.describe("Component Details - Buttons", () => {
  test.skip(!hasCredentials(), "Requires test credentials");

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await login(page);
  });

  test("Button States", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Capture the primary button state from the sidebar or main interface
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await expect(button).toHaveScreenshot("button-primary-normal.png");

      await button.hover();
      await expect(button).toHaveScreenshot("button-primary-hover.png");
    }
  });

  test("Secondary Button States", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Find secondary/outline style buttons
    const secondaryButton = page.locator('button[class*="secondary"], button[class*="outline"]').first();
    if (await secondaryButton.count() > 0) {
      await expect(secondaryButton).toHaveScreenshot("button-secondary-normal.png");
    }
  });
});
