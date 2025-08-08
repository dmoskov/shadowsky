import fs from "fs";
import { chromium } from "playwright";

async function testColorSystem() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // Load credentials
    const creds = fs.readFileSync(".test-credentials", "utf8");
    const username = creds.match(/TEST_USER=(.+)/)[1];
    const password = creds.match(/TEST_PASS=(.+)/)[1];

    console.log("🎨 Testing new color system...\n");

    await page.goto("http://localhost:5173");

    // Login if needed
    if (await page.isVisible("button").catch(() => false)) {
      await page.fill('input[placeholder*="Username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForSelector(".header", { timeout: 10000 });
    }

    // Check CSS variables are loaded
    const colorCheck = await page.evaluate(() => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);

      return {
        // Check new color system
        blue500: computed.getPropertyValue("--blue-500"),
        gray950: computed.getPropertyValue("--gray-950"),
        colorBgPrimary: computed.getPropertyValue("--color-bg-primary"),
        colorError: computed.getPropertyValue("--color-error"),
        colorNotificationLike: computed.getPropertyValue(
          "--color-notification-like",
        ),

        // Check deprecated variable is gone
        dangerColor: computed.getPropertyValue("--danger-color"),

        // Check actual colors being used
        bodyBg: getComputedStyle(document.body).backgroundColor,
        headerBg: document.querySelector(".header")
          ? getComputedStyle(document.querySelector(".header")).backgroundColor
          : null,
      };
    });

    console.log("✅ Color System Check:");
    console.log("   --blue-500:", colorCheck.blue500 || "❌ NOT DEFINED");
    console.log("   --gray-950:", colorCheck.gray950 || "❌ NOT DEFINED");
    console.log("   --color-bg-primary:", colorCheck.colorBgPrimary);
    console.log("   --color-error:", colorCheck.colorError);
    console.log(
      "   --danger-color (should be empty):",
      colorCheck.dangerColor || "✅ REMOVED",
    );
    console.log("\n   Body background:", colorCheck.bodyBg);
    console.log("   Header background:", colorCheck.headerBg);

    // Take screenshots at different sections
    console.log("\n📸 Taking screenshots...");

    // Main feed
    await page.screenshot({
      path: "test-screenshots/color-system-feed.png",
      fullPage: false,
    });

    // Open compose modal
    await page.click(".compose-fab, .sidebar-compose-btn");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "test-screenshots/color-system-compose.png",
      fullPage: false,
    });
    await page.keyboard.press("Escape");

    // Navigate to notifications
    await page.click('a[href="/notifications"]');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "test-screenshots/color-system-notifications.png",
      fullPage: false,
    });

    // Test hover states
    console.log("\n🖱️ Testing interactive states...");
    const button = await page.locator(".btn-primary").first();
    if (button) {
      await button.hover();
      const hoverColor = await button.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      console.log("   Primary button hover color:", hoverColor);
    }

    console.log("\n✅ Color system test complete!");
    console.log("📁 Screenshots saved to test-screenshots/");
  } catch (error) {
    console.error("❌ Error:", error);
    await page.screenshot({
      path: "test-screenshots/color-system-error.png",
      fullPage: true,
    });
  }

  await browser.close();
}

testColorSystem();
