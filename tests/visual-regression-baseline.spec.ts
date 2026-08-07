import { expect, test } from "@playwright/test";

// Test configuration
const TEST_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5174";

// Configuration for visual regression tests
// Note: fullPage is set to false to ensure consistent viewport-based snapshots
// across different platforms (Linux/macOS) that may render content differently
const VISUAL_CONFIG = {
  fullPage: false,
  animations: "disabled" as const,
};

// Check if credentials are available
function hasCredentials() {
  const identifier =
    process.env.TEST_USER || process.env.VITE_TEST_IDENTIFIER || "";
  const password =
    process.env.TEST_PASS || process.env.VITE_TEST_PASSWORD || "";
  return !!(identifier && password);
}

// Helper to get credentials from environment variables
function getCredentials() {
  const identifier =
    process.env.TEST_USER || process.env.VITE_TEST_IDENTIFIER || "";
  const password =
    process.env.TEST_PASS || process.env.VITE_TEST_PASSWORD || "";

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
  await page.waitForSelector(
    'input[placeholder*="handle" i], input[placeholder*="Username" i], input[placeholder*="email" i]',
    { timeout: 10000 },
  );

  // Fill in credentials - try different input selectors
  const handleInput = page
    .locator('input[placeholder*="handle" i], input[placeholder*="Username" i]')
    .first();
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

  // Deliberately not a screenshot test. This previously called
  // toHaveScreenshot after a plain goto, hoping to catch the app mid-load, but
  // toHaveScreenshot retries until two consecutive frames match — it waits for
  // the page to be *stable*, so it can only ever capture a settled page. The
  // committed baseline was therefore just a second copy of the landing page,
  // which is why it rotted silently when the front door was rebuilt and why it
  // failed locally while passing in CI. Asserting on the DOM instead makes the
  // loading state reproducible and needs no baseline.
  test("14 - boot splash shows until the app mounts, then gives way", async ({
    page,
  }) => {
    // The splash markup lives inside #root and React replaces it on mount, so
    // blocking scripts is what pins the app in its loading state.
    await page.route("**/*", (route) =>
      route.request().resourceType() === "script"
        ? route.abort()
        : route.continue(),
    );
    await page.goto(TEST_URL);

    await expect(page.getByText("Loading Asphodel...")).toBeVisible();

    // Let the scripts through: the splash must be replaced by the real app.
    await page.unroute("**/*");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Loading Asphodel...")).toBeHidden();
    await expect(
      page.getByText("Sign in with your Bluesky account"),
    ).toBeVisible();
  });
});

test.describe("Visual Regression Baseline - Authenticated", () => {
  // Load-bearing: these tests login to a real Bluesky account to screenshot
  // authenticated views — they cannot run without TEST_USER/TEST_PASS.
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
  // Load-bearing: button-state screenshots require an authenticated session.
  test.skip(!hasCredentials(), "Requires test credentials");

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await login(page);
  });

  test("Button States", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Capture the primary button state from the sidebar or main interface
    const button = page.locator("button").first();
    if (await button.isVisible()) {
      await expect(button).toHaveScreenshot("button-primary-normal.png");

      await button.hover();
      await expect(button).toHaveScreenshot("button-primary-hover.png");
    }
  });

  test("Secondary Button States", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Find secondary/outline style buttons
    const secondaryButton = page
      .locator('button[class*="secondary"], button[class*="outline"]')
      .first();
    if ((await secondaryButton.count()) > 0) {
      await expect(secondaryButton).toHaveScreenshot(
        "button-secondary-normal.png",
      );
    }
  });
});
