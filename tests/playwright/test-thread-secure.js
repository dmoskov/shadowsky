import { chromium } from "playwright";
import { getTestCredentials } from "./helpers/credentials.js";

/**
 * Thread test using secure credential management
 * This is the new pattern all tests should follow
 */
async function testThreadSecure() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log("🔒 Secure thread test with environment variables\n");

    // Get credentials securely
    const { identifier, password } = await getTestCredentials();
    console.log(`📧 Using account: ${identifier.split("@")[0]}@****`);

    // Navigate to the app
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Login
    console.log("🔐 Logging in securely...");
    await page.fill('input[placeholder="Username or email"]', identifier);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');

    // Wait for feed
    await page.waitForSelector(".feed-container", { timeout: 15000 });
    console.log("✅ Login successful");

    // Find and click a post
    const firstPost = await page.locator(".post-card").first();
    await firstPost.click();

    // Wait for thread
    await page.waitForSelector(".thread-container", { timeout: 5000 });
    console.log("✅ Thread loaded successfully");

    // Take screenshot
    await page.screenshot({
      path: "test-screenshots/thread-secure-test.png",
      fullPage: true,
    });

    console.log("✅ Test completed successfully");
    console.log("📸 Screenshot saved: thread-secure-test.png");
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    // Take error screenshot
    await page.screenshot({
      path: "test-screenshots/thread-secure-error.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

// Run the test
testThreadSecure().catch(console.error);
