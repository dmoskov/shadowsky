import { expect, test } from "@playwright/test";
import fs from "fs/promises";

// Test configuration
const TEST_URL = "http://localhost:5173";
const CREDENTIALS_PATH = ".test-credentials";

// Helper to parse credentials
async function getCredentials() {
  const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
  const lines = content.split("\n");
  let identifier = "";
  let password = "";

  for (const line of lines) {
    if (line.startsWith("TEST_USER=")) {
      identifier = line.split("=")[1].trim();
    } else if (line.startsWith("TEST_PASS=")) {
      password = line.split("=")[1].trim();
    }
  }

  return { identifier, password };
}

// Helper to login
async function login(page: any) {
  const { identifier, password } = await getCredentials();
  await page.fill('input[placeholder="Username or email"]', identifier);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(TEST_URL + "/", { timeout: 10000 });
}

test.describe("Visual Regression Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
  });

  test("Login page styling", async ({ page }) => {
    // Check login page renders correctly
    await expect(page.locator(".login-container")).toBeVisible();
    await expect(page).toHaveScreenshot("01-login-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Feed view styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container", { timeout: 10000 });

    // Wait for posts to load
    await page.waitForSelector(".post-card", { timeout: 5000 });
    await page.waitForTimeout(1000); // Let images load

    await expect(page).toHaveScreenshot("02-feed-view.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Thread view styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Click on first post
    const firstPost = page.locator(".post-card").first();
    await firstPost.locator(".post-content").click();

    // Wait for thread view
    await page.waitForSelector(".thread-container", { timeout: 5000 });
    await page.waitForTimeout(1000); // Let animations complete

    // Check key elements are visible
    await expect(page.locator(".thread-posts")).toBeVisible();

    await expect(page).toHaveScreenshot("03-thread-view.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Thread with replies styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Find a post with replies
    const postWithReplies = page
      .locator(".post-card")
      .filter({
        has: page.locator(".post-engagement button:first-child span").filter({
          hasText: /^[1-9]\d*$/,
        }),
      })
      .first();

    if (await postWithReplies.isVisible()) {
      await postWithReplies.locator(".post-content").click();
      await page.waitForSelector(".thread-container");
      await page.waitForSelector(".thread-replies", { timeout: 5000 });

      await expect(page).toHaveScreenshot("04-thread-with-replies.png", {
        fullPage: true,
        animations: "disabled",
      });
    }
  });

  test("Mobile feed view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.waitForSelector(".feed-container");
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("05-mobile-feed.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Mobile thread view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.waitForSelector(".feed-container");

    // Click first post
    const firstPost = page.locator(".post-card").first();
    await firstPost.click();
    await page.waitForSelector(".thread-container", { timeout: 5000 });

    await expect(page).toHaveScreenshot("06-mobile-thread.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Profile page styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Navigate to profile
    await page.click('.sidebar a[href*="profile"]');
    await page.waitForSelector(".profile-page", { timeout: 5000 });

    await expect(page).toHaveScreenshot("07-profile-page.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Search page styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Navigate to search
    await page.click('.sidebar a[href="/search"]');
    await page.waitForSelector(".search-page", { timeout: 5000 });

    await expect(page).toHaveScreenshot("08-search-page.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("Compose modal styling", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Open compose modal
    await page.click('.sidebar button:has-text("New Post")');
    await page.waitForSelector(".compose-modal", { timeout: 5000 });

    await expect(page).toHaveScreenshot("09-compose-modal.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Dark theme consistency", async ({ page }) => {
    await login(page);
    await page.waitForSelector(".feed-container");

    // Check CSS variables are applied
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--color-bg-primary")
        .trim();
    });

    expect(bgColor).toBe("#0a0e1a");
  });
});

test.describe("Component Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await login(page);
    await page.waitForSelector(".feed-container");
  });

  test("Post card hover states", async ({ page }) => {
    const firstPost = page.locator(".post-card").first();

    // Normal state
    await expect(firstPost).toHaveScreenshot("post-card-normal.png");

    // Hover state
    await firstPost.hover();
    await page.waitForTimeout(100); // Let transition complete
    await expect(firstPost).toHaveScreenshot("post-card-hover.png");
  });

  test("Engagement button states", async ({ page }) => {
    const firstPost = page.locator(".post-card").first();
    const likeButton = firstPost.locator(".post-engagement button").first();

    // Check hover tooltip
    await likeButton.hover();
    await page.waitForTimeout(500); // Wait for tooltip

    const tooltip = page.locator(".tooltip");
    if (await tooltip.isVisible()) {
      await expect(page.locator(".post-engagement")).toHaveScreenshot(
        "engagement-with-tooltip.png",
      );
    }
  });

  test("Thread hierarchy visual", async ({ page }) => {
    // Navigate to a thread
    const firstPost = page.locator(".post-card").first();
    await firstPost.locator(".post-content").click();
    await page.waitForSelector(".thread-container");

    // Check specific thread elements
    const mainPost = page.locator(".thread-main-post");
    if (await mainPost.isVisible()) {
      await expect(mainPost).toHaveScreenshot("thread-main-post.png");
    }

    const nestedReply = page.locator(".thread-post-nested").first();
    if (await nestedReply.isVisible()) {
      await expect(nestedReply).toHaveScreenshot("thread-nested-reply.png");
    }
  });
});

test.describe("Responsive Design Tests", () => {
  const viewports = [
    { name: "desktop-lg", width: 1920, height: 1080 },
    { name: "desktop", width: 1280, height: 720 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`Feed layout at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(TEST_URL);
      await login(page);
      await page.waitForSelector(".feed-container");
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot(`feed-${viewport.name}.png`, {
        fullPage: false,
        animations: "disabled",
      });
    });
  }
});
