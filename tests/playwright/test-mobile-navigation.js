import fs from "fs";
import { chromium } from "playwright";

async function testMobileNavigation() {
  const browser = await chromium.launch({ headless: false });

  // Test different viewport sizes
  const viewports = [
    { name: "mobile-small", width: 375, height: 667 }, // iPhone SE
    { name: "mobile-large", width: 414, height: 896 }, // iPhone 11 Pro Max
    { name: "tablet", width: 768, height: 1024 }, // iPad
    { name: "desktop", width: 1280, height: 800 }, // Desktop
  ];

  for (const viewport of viewports) {
    console.log(
      `\n📱 Testing ${viewport.name} (${viewport.width}x${viewport.height})...`,
    );

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    try {
      // Load credentials
      const creds = fs.readFileSync(".test-credentials", "utf8");
      const username = creds.match(/TEST_USER=(.+)/)[1];
      const password = creds.match(/TEST_PASS=(.+)/)[1];

      await page.goto("http://localhost:5173");

      // Login if needed
      if (await page.isVisible("button").catch(() => false)) {
        await page.fill('input[placeholder*="Username"]', username);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForSelector(".header", { timeout: 10000 });
      }

      // Check what navigation elements are visible
      const navState = await page.evaluate(() => {
        return {
          hasSidebar:
            !!document.querySelector(".sidebar") &&
            getComputedStyle(document.querySelector(".sidebar")).display !==
              "none",
          hasBottomNav: !!document.querySelector(".mobile-nav-bottom"),
          hasHamburgerMenu: !!document.querySelector(".mobile-menu-toggle"),
          headerElements: {
            logo: !!document.querySelector(".logo"),
            search: !!document.querySelector(".search-input"),
            mobileSearch: !!document.querySelector(".mobile-search-btn"),
            notifications: !!document.querySelector(".notification-btn"),
            userMenu: !!document.querySelector(".user-menu-trigger"),
          },
          composeFAB: !!document.querySelector(".compose-fab"),
        };
      });

      console.log("Navigation state:", navState);

      // Take screenshot
      await page.screenshot({
        path: `test-screenshots/mobile-nav-${viewport.name}.png`,
        fullPage: false,
      });

      // Test interactions on mobile
      if (viewport.width < 768) {
        console.log("Testing mobile interactions...");

        // Check if hamburger menu exists and works
        if (navState.hasHamburgerMenu) {
          await page.click(".mobile-menu-toggle");
          await page.waitForTimeout(300);

          const menuOpen = await page.evaluate(() => {
            const menu = document.querySelector(".mobile-menu");
            return menu && getComputedStyle(menu).display !== "none";
          });

          console.log("Mobile menu opens:", menuOpen);

          await page.screenshot({
            path: `test-screenshots/mobile-nav-${viewport.name}-menu-open.png`,
            fullPage: false,
          });
        }

        // Check compose FAB
        if (navState.composeFAB) {
          const fabPosition = await page.evaluate(() => {
            const fab = document.querySelector(".compose-fab");
            const rect = fab.getBoundingClientRect();
            return {
              bottom: window.innerHeight - rect.bottom,
              right: window.innerWidth - rect.right,
            };
          });
          console.log("Compose FAB position from bottom-right:", fabPosition);
        }
      }
    } catch (error) {
      console.error(`Error testing ${viewport.name}:`, error.message);
    } finally {
      await context.close();
    }
  }

  console.log("\n✅ Mobile navigation test complete!");
  console.log("📸 Screenshots saved to test-screenshots/");

  await browser.close();
}

testMobileNavigation();
