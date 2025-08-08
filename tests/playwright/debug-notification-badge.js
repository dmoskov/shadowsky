import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

async function debugNotificationBadge() {
  const browser = await chromium.launch({
    headless: false,
    devtools: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Enable console logging
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.error("PAGE ERROR:", err));

  try {
    console.log("🔍 Starting notification badge debug...\n");

    // Navigate to the app
    await page.goto("http://localhost:5173", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Check if we need to login first
    const loginButton = await page.$('button:has-text("Login")');
    if (loginButton) {
      console.log("⚠️  Login required. Please login manually in the browser.");
      console.log("   Once logged in, press Enter here to continue...");

      // Wait for user to press Enter
      await new Promise((resolve) => {
        process.stdin.once("data", resolve);
      });
    }

    // Wait for the notification button to be visible
    await page.waitForSelector(".notification-btn", { timeout: 10000 });
    console.log("✅ Found notification button\n");

    // Get notification badge info
    const badgeInfo = await page.evaluate(() => {
      const notificationBtn = document.querySelector(".notification-btn");
      const badge = document.querySelector(".notification-badge");

      if (!badge) {
        return {
          exists: false,
          buttonInfo: notificationBtn ? "Button exists" : "Button not found",
        };
      }

      const computedStyles = window.getComputedStyle(badge);
      const parentStyles = window.getComputedStyle(notificationBtn);

      // Get all CSS rules that apply to the badge
      const matchingRules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || sheet.rules) {
            if (rule.selectorText && badge.matches(rule.selectorText)) {
              matchingRules.push({
                selector: rule.selectorText,
                styles: rule.style.cssText,
              });
            }
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }

      return {
        exists: true,
        content: badge.textContent,
        boundingBox: badge.getBoundingClientRect(),
        parentBoundingBox: notificationBtn.getBoundingClientRect(),
        computedStyles: {
          position: computedStyles.position,
          top: computedStyles.top,
          right: computedStyles.right,
          backgroundColor: computedStyles.backgroundColor,
          color: computedStyles.color,
          fontSize: computedStyles.fontSize,
          fontWeight: computedStyles.fontWeight,
          padding: computedStyles.padding,
          borderRadius: computedStyles.borderRadius,
          border: computedStyles.border,
          minWidth: computedStyles.minWidth,
          height: computedStyles.height,
          display: computedStyles.display,
          alignItems: computedStyles.alignItems,
          justifyContent: computedStyles.justifyContent,
          zIndex: computedStyles.zIndex,
          opacity: computedStyles.opacity,
          visibility: computedStyles.visibility,
          transform: computedStyles.transform,
        },
        parentStyles: {
          position: parentStyles.position,
          display: parentStyles.display,
          overflow: parentStyles.overflow,
          zIndex: parentStyles.zIndex,
        },
        matchingRules,
        // Check if element is actually visible
        isVisible:
          badge.offsetParent !== null &&
          computedStyles.display !== "none" &&
          computedStyles.visibility !== "hidden" &&
          computedStyles.opacity !== "0",
      };
    });

    if (!badgeInfo.exists) {
      console.log("❌ No notification badge found. This could mean:");
      console.log("   - No unread notifications");
      console.log("   - Badge is hidden by CSS");
      console.log("   - Badge element not rendered\n");
    } else {
      console.log("📊 Notification Badge Analysis:\n");
      console.log("Content:", badgeInfo.content || "(empty)");
      console.log("Visible:", badgeInfo.isVisible ? "Yes" : "No");
      console.log("\n📐 Positioning:");
      console.log("Badge bounds:", badgeInfo.boundingBox);
      console.log("Button bounds:", badgeInfo.parentBoundingBox);
      console.log("\n🎨 Computed Styles:");
      Object.entries(badgeInfo.computedStyles).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      console.log("\n📦 Parent (Button) Styles:");
      Object.entries(badgeInfo.parentStyles).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      console.log("\n📋 Matching CSS Rules:");
      badgeInfo.matchingRules.forEach((rule) => {
        console.log(`  ${rule.selector}:`);
        console.log(`    ${rule.styles}`);
      });
    }

    // Take a close-up screenshot of the notification area
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotDir = "./test-screenshots";

    // Ensure directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Full page screenshot
    const fullPagePath = path.join(
      screenshotDir,
      `notification-debug-full-${timestamp}.png`,
    );
    await page.screenshot({ path: fullPagePath, fullPage: false });
    console.log(`\n📸 Full page screenshot saved: ${fullPagePath}`);

    // Close-up of notification button
    const notificationBtn = await page.$(".notification-btn");
    if (notificationBtn) {
      const closeupPath = path.join(
        screenshotDir,
        `notification-debug-closeup-${timestamp}.png`,
      );
      await notificationBtn.screenshot({ path: closeupPath });
      console.log(`📸 Close-up screenshot saved: ${closeupPath}`);
    }

    // Try to trigger notification count update
    console.log("\n🔄 Attempting to trigger notification update...");
    await page.goto("http://localhost:5173/notifications", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Check badge again after navigation
    const badgeAfterNav = await page.$(".notification-badge");
    if (badgeAfterNav) {
      const afterNavPath = path.join(
        screenshotDir,
        `notification-debug-after-nav-${timestamp}.png`,
      );
      await page.screenshot({ path: afterNavPath });
      console.log(`📸 After navigation screenshot saved: ${afterNavPath}`);
    }

    console.log("\n✅ Debug complete!");
    console.log("\n💡 Common issues and solutions:");
    console.log("1. Badge not visible: Check z-index and parent overflow");
    console.log(
      "2. Badge positioned incorrectly: Verify parent has position:relative",
    );
    console.log("3. Badge cut off: Check parent overflow property");
    console.log("4. Badge behind other elements: Increase z-index");
  } catch (error) {
    console.error("❌ Error during debug:", error);
  } finally {
    // Keep browser open for manual inspection
    console.log("\n🔍 Browser will remain open for manual inspection.");
    console.log("   Press Ctrl+C to close and exit.");

    // Wait indefinitely
    await new Promise(() => {});
  }
}

// Run the debug script
debugNotificationBadge().catch(console.error);
