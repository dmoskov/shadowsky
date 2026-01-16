import { expect, test } from "@playwright/test";

// Test configuration
const TEST_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5174";

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

// Tests that don't require authentication
test.describe("Visual Regression - Landing Page", () => {
  test("Landing page styling", async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Let animations settle

    await expect(page).toHaveScreenshot("01-landing-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Landing page - mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("01-landing-page-mobile.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Landing page - tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(TEST_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("01-landing-page-tablet.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

// Tests that require authentication
test.describe("Visual Regression - Authenticated Views", () => {
  // Skip all tests in this block if no credentials
  test.skip(!hasCredentials(), "Requires test credentials");

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await login(page);
  });

  test("Feed view styling", async ({ page }) => {
    await page.waitForTimeout(2000); // Let feed load

    await expect(page).toHaveScreenshot("02-feed-view.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Feed view - mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot("02-feed-view-mobile.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Feed view - tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot("02-feed-view-tablet.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Feed view - large desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot("02-feed-view-desktop-lg.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Search page styling", async ({ page }) => {
    // Navigate to search using URL
    await page.goto(`${TEST_URL}/search`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("03-search-page.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Notifications page styling", async ({ page }) => {
    await page.goto(`${TEST_URL}/notifications`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("04-notifications-page.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Settings page styling", async ({ page }) => {
    await page.goto(`${TEST_URL}/settings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("05-settings-page.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Dark theme consistency", async ({ page }) => {
    // Check CSS variables are applied
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--bsky-bg-primary")
        .trim();
    });

    // Should have a dark background color
    expect(bgColor).toBeTruthy();
  });
});

// Responsive viewport tests
test.describe("Responsive Design Tests", () => {
  test.skip(!hasCredentials(), "Requires test credentials");

  const viewports = [
    { name: "desktop-lg", width: 1920, height: 1080 },
    { name: "desktop", width: 1280, height: 720 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`Layout at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(TEST_URL);
      await login(page);
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot(`responsive-${viewport.name}.png`, {
        fullPage: false,
        animations: "disabled",
      });
    });
  }
});
