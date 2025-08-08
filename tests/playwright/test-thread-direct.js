import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testThreadDirect() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then((c) => c.newPage());

  try {
    console.log("🧪 Testing thread view directly...\n");

    // Navigate and login
    await page.goto("http://localhost:5173");

    const credentialsPath = path.join(__dirname, "../../.test-credentials");
    const credentialsContent = await fs.readFile(credentialsPath, "utf8");

    const lines = credentialsContent.split("\n");
    let identifier = "";
    let password = "";

    for (const line of lines) {
      if (line.startsWith("TEST_USER=")) {
        identifier = line.split("=")[1].trim();
      } else if (line.startsWith("TEST_PASS=")) {
        password = line.split("=")[1].trim();
      }
    }

    await page.fill('input[placeholder="Username or email"]', identifier);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');

    // Wait for feed
    await page.waitForSelector(".feed-container", { timeout: 15000 });
    console.log("✅ Logged in and feed loaded");

    // Get a post URI from the feed
    const firstPost = await page.locator(".post-card").first();
    const postUri = await firstPost.evaluate((el) => {
      // Try to extract URI from the post card
      const link = el.querySelector('a[href*="/thread/"]');
      if (link) {
        const href = link.getAttribute("href");
        return href?.replace("/thread/", "");
      }
      return null;
    });

    if (postUri) {
      console.log("📍 Found post URI, navigating directly...");
      const decodedUri = decodeURIComponent(postUri);
      console.log("URI:", decodedUri);

      // Navigate directly to thread URL
      await page.goto(`http://localhost:5173/thread/${postUri}`);

      // Wait for thread to load
      console.log("⏳ Waiting for thread view...");
      await page.waitForSelector(".thread-container", { timeout: 5000 });
      console.log("✅ Thread loaded!");

      // Take screenshot
      await page.screenshot({
        path: "test-screenshots/thread-direct-test.png",
        fullPage: true,
      });

      // Check CSS classes
      const structure = await page.evaluate(() => {
        const results = {};
        const selectors = [
          ".thread-container",
          ".thread-posts",
          ".thread-ancestor",
          ".thread-main-post",
          ".thread-replies",
          ".thread-reply",
          ".thread-post-nested",
          ".thread-children",
          ".depth-1",
          ".is-op",
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          results[selector] = elements.length;
        }

        return results;
      });

      console.log("\n📊 Thread structure:");
      for (const [selector, count] of Object.entries(structure)) {
        console.log(`  ${selector}: ${count}`);
      }
    } else {
      // Try clicking on the post card itself
      console.log("⚠️ No thread link found, trying to click post card...");

      // Click on a non-interactive area of the post
      await firstPost.locator(".post-content").click();

      // Wait and check
      await page.waitForTimeout(2000);

      const isThread = await page
        .locator(".thread-container")
        .isVisible()
        .catch(() => false);
      if (isThread) {
        console.log("✅ Thread view loaded after click!");
        await page.screenshot({
          path: "test-screenshots/thread-click-test.png",
          fullPage: true,
        });
      } else {
        console.log("❌ Thread view did not load");
      }
    }

    console.log("\n✨ Test complete!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    await page.screenshot({
      path: "test-screenshots/thread-direct-error.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

testThreadDirect().catch(console.error);
