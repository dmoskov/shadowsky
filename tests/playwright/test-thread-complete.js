import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testThreadComplete() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log("🧪 Complete thread styling test...\n");

    // Navigate to the app
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Login
    console.log("📝 Logging in...");
    const credentialsPath = path.join(__dirname, "../../.test-credentials");
    const credentialsContent = await fs.readFile(credentialsPath, "utf8");

    // Parse the credentials file
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

    // Wait for navigation
    console.log("⏳ Waiting for feed to load...");
    await page.waitForSelector(".feed-container", { timeout: 15000 });
    await page.waitForTimeout(2000); // Let posts load

    // Take feed screenshot
    await page.screenshot({
      path: "test-screenshots/thread-test-01-feed.png",
      fullPage: false,
    });
    console.log("✅ Feed screenshot saved");

    // Find a post with replies - try multiple strategies
    console.log("🔍 Looking for posts with replies...");

    // Strategy 1: Look for reply count > 0
    let postWithReplies = await page
      .locator(".post-card")
      .filter({
        has: page.locator(".post-engagement button:first-child span").filter({
          hasText: /^[1-9]\d*$/,
        }),
      })
      .first();

    // Check if we found one
    const hasReplies = await postWithReplies.isVisible().catch(() => false);

    if (!hasReplies) {
      console.log("⚠️ No posts with visible reply counts, trying any post...");
      postWithReplies = await page.locator(".post-card").first();
    }

    if (await postWithReplies.isVisible()) {
      console.log("✅ Found post, clicking to view thread...");

      // Get post info before clicking
      const postText = await postWithReplies
        .locator(".post-content")
        .textContent()
        .catch(() => "Unknown");
      console.log(`📄 Post preview: "${postText.substring(0, 50)}..."`);

      await postWithReplies.click();

      // Wait for thread to load
      console.log("⏳ Waiting for thread view...");
      await page.waitForSelector(".thread-container", { timeout: 10000 });
      await page.waitForTimeout(1500); // Let animations complete

      // Take thread screenshots
      console.log("📸 Taking thread screenshots...");

      // Full thread view
      await page.screenshot({
        path: "test-screenshots/thread-test-02-full.png",
        fullPage: true,
      });
      console.log("✅ Full thread screenshot saved");

      // Check thread structure
      console.log("\n📊 Thread structure analysis:");

      const structure = {
        "Thread container": await page.locator(".thread-container").count(),
        "Thread posts wrapper": await page.locator(".thread-posts").count(),
        "Ancestor posts": await page.locator(".thread-ancestor").count(),
        "Main post": await page.locator(".thread-main-post").count(),
        "Reply section": await page.locator(".thread-replies").count(),
        "Individual replies": await page.locator(".thread-reply").count(),
        "Nested posts": await page.locator(".thread-post-nested").count(),
        "Depth-0": await page.locator(".depth-0").count(),
        "Depth-1": await page.locator(".depth-1").count(),
        "Depth-2": await page.locator(".depth-2").count(),
        "OP indicators": await page.locator(".is-op").count(),
      };

      for (const [element, count] of Object.entries(structure)) {
        const icon = count > 0 ? "✅" : "❌";
        console.log(`  ${icon} ${element}: ${count}`);
      }

      // Take focused screenshots of key areas
      const mainPost = await page.locator(".thread-main-post");
      if (await mainPost.isVisible()) {
        await mainPost.screenshot({
          path: "test-screenshots/thread-test-03-main-post.png",
        });
        console.log("\n✅ Main post screenshot saved");
      }

      // Check CSS variables are applied
      const computedStyles = await page.evaluate(() => {
        const container = document.querySelector(".thread-container");
        if (!container) return null;
        const styles = getComputedStyle(container);
        return {
          maxWidth: styles.maxWidth,
          background: styles.backgroundColor,
          margin: styles.margin,
        };
      });

      console.log("\n🎨 Thread container styles:");
      if (computedStyles) {
        for (const [prop, value] of Object.entries(computedStyles)) {
          console.log(`  - ${prop}: ${value}`);
        }
      }

      // Test mobile view
      console.log("\n📱 Testing mobile view...");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: "test-screenshots/thread-test-04-mobile.png",
        fullPage: false,
      });
      console.log("✅ Mobile screenshot saved");
    } else {
      console.log("❌ Could not find any posts to click");
    }

    console.log("\n✨ Thread test complete!");
    console.log("📁 Check test-screenshots/ for results");
  } catch (error) {
    console.error("❌ Test failed:", error);
    await page.screenshot({
      path: "test-screenshots/thread-test-error.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

// Run the test
testThreadComplete().catch(console.error);
