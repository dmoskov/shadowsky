import { test } from "@playwright/test";
import path from "path";

test.describe("Bluesky Client Verification", () => {
  // Helper function to take and save screenshot
  async function takeScreenshot(page: any, name: string) {
    const screenshotPath = path.join("tests", "screenshots", `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  }

  test("verify app functionality", async ({ page }) => {
    // Set a longer timeout for this test
    test.setTimeout(60000);

    // 1. Navigate to the app and screenshot login page
    console.log("1. Navigating to app...");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await takeScreenshot(page, "1-login-page");

    // Check if we're on the login page
    const loginForm = await page.locator("form").first();
    const isLoginPage = await loginForm.isVisible().catch(() => false);

    if (isLoginPage) {
      console.log("Login page detected");

      // Try to login if we have credentials
      try {
        // Fill in login form (you'll need to provide actual credentials)
        // For now, we'll just capture the login page
        console.log(
          "Login form is visible - would need credentials to proceed",
        );

        // Check for username/handle input
        const handleInput = await page
          .locator(
            'input[type="text"], input[placeholder*="handle"], input[placeholder*="username"], input[name*="handle"], input[name*="username"]',
          )
          .first();
        if (await handleInput.isVisible()) {
          console.log("Handle/username input found");
        }

        // Check for password input
        const passwordInput = await page
          .locator('input[type="password"]')
          .first();
        if (await passwordInput.isVisible()) {
          console.log("Password input found");
        }

        // Check for login button
        const loginButton = await page
          .locator(
            'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")',
          )
          .first();
        if (await loginButton.isVisible()) {
          console.log("Login button found");
        }
      } catch (error) {
        console.log("Error checking login form elements:", error);
      }
    } else {
      console.log("Not on login page - might already be logged in");

      // 2. If already logged in, capture the feed
      await takeScreenshot(page, "2-logged-in-feed");

      // 3. Check if feed is displaying
      try {
        // Wait for feed content
        const feedContent = await page
          .locator('[role="feed"], .feed, main')
          .first();
        if (await feedContent.isVisible()) {
          console.log("Feed container found");
          await takeScreenshot(page, "3-feed-displaying");
        }

        // Check for posts
        const posts = await page
          .locator('article, [role="article"], .post, .post-card')
          .all();
        console.log(`Found ${posts.length} posts`);
      } catch (error) {
        console.log("Error checking feed:", error);
      }

      // 4. Check for sidebar
      try {
        const sidebar = await page.locator("aside, nav, .sidebar").first();
        if (await sidebar.isVisible()) {
          console.log("Sidebar found");
          await takeScreenshot(page, "4-sidebar-visible");
        }
      } catch (error) {
        console.log("Sidebar not found");
      }

      // 5. Check for compose button
      try {
        const composeButton = await page
          .locator(
            'button:has-text("Compose"), button:has-text("New post"), button:has-text("Post"), button[aria-label*="compose"], button[aria-label*="new"], .compose-button',
          )
          .first();
        if (await composeButton.isVisible()) {
          console.log("Compose button found");

          // Click compose button to test it
          await composeButton.click();
          await page.waitForTimeout(1000); // Wait for any animation

          // Check if compose modal or area opened
          const composeArea = await page
            .locator(
              'textarea, [contenteditable="true"], .compose-area, .compose-modal',
            )
            .first();
          if (await composeArea.isVisible()) {
            console.log("Compose area opened successfully");
            await takeScreenshot(page, "5-compose-button-working");

            // Close compose area if there's a close button
            const closeButton = await page
              .locator(
                'button[aria-label*="close"], button:has-text("Cancel"), .close-button',
              )
              .first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
            }
          }
        }
      } catch (error) {
        console.log("Compose button not found or not working:", error);
      }
    }

    // Take a final screenshot of the current state
    await takeScreenshot(page, "final-state");

    // Report summary
    console.log("\n=== Test Summary ===");
    console.log("Screenshots have been saved to tests/screenshots/");
    console.log("Review the screenshots to verify app functionality");
  });
});
