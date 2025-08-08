import { chromium } from "playwright";

import { getTestCredentials } from "./src/lib/test-credentials.js";
async function captureExperimentalFeatures() {
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1400, height: 900 },
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto("http://127.0.0.1:5173/");
  console.log("Navigated to login page");

  // Fill in login form
  const credentials = getTestCredentials();

  await page.fill(
    'input[placeholder="Username or email"]',
    credentials.identifier,
  );
  await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button[type="submit"]');
  console.log("Submitted login form");

  // Wait for feed to load
  await page.waitForSelector(".feed-container", { timeout: 10000 });
  console.log("Feed loaded successfully");

  // Find a post with replies and click it
  await page.waitForTimeout(2000); // Let feed stabilize

  // Try to find any post to click - we can still test even without replies
  const posts = await page.$$(".post-card");
  console.log(`Found ${posts.length} posts`);

  if (posts.length > 0) {
    // Click on the first post
    await posts[0].click();
    console.log("Clicked on first post");

    // Wait for thread view to load
    await page.waitForSelector(".thread-container", { timeout: 10000 });
    console.log("Thread view loaded");

    // Check if participants are enabled and wait
    try {
      await page.waitForSelector(".thread-participants-compact", {
        timeout: 3000,
      });
      console.log("Thread participants loaded");
    } catch (e) {
      console.log(
        "Thread participants not found - feature may be disabled or no data",
      );
    }

    // Take screenshot of thread with participants
    await page.screenshot({
      path: "test-screenshots/experimental-1-participants.png",
      fullPage: false,
    });
    console.log("Captured thread with participants");

    // Click the map button to show thread overview
    const mapButton = await page.$('button[title="Show thread map"]');
    if (mapButton) {
      await mapButton.click();
      console.log("Clicked map button");

      // Wait for map to appear
      await page.waitForSelector(".thread-overview-map", { timeout: 5000 });
      await page.waitForTimeout(1000); // Let animation complete

      // Take screenshot with map
      await page.screenshot({
        path: "test-screenshots/experimental-2-map-minimized.png",
        fullPage: false,
      });
      console.log("Captured thread with minimized map");

      // Click expand button
      const expandButton = await page.$(
        '.thread-overview-map button[title="Expand map"]',
      );
      if (expandButton) {
        await expandButton.click();
        await page.waitForTimeout(500); // Let animation complete

        await page.screenshot({
          path: "test-screenshots/experimental-3-map-expanded.png",
          fullPage: false,
        });
        console.log("Captured thread with expanded map");

        // Try clicking on a node in the map
        const mapNodes = await page.$$(".map-node");
        if (mapNodes.length > 2) {
          await mapNodes[2].click();
          await page.waitForTimeout(1000); // Let scroll animation complete

          await page.screenshot({
            path: "test-screenshots/experimental-4-map-navigation.png",
            fullPage: false,
          });
          console.log("Captured after map navigation");
        }
      }
    }

    // Scroll down to see more of the thread
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "test-screenshots/experimental-5-thread-scrolled.png",
      fullPage: false,
    });
    console.log("Captured scrolled thread view");
  } else {
    console.log("No posts found in feed");
  }

  // Close browser after a delay to see results
  setTimeout(async () => {
    await browser.close();
    console.log("Test completed");
  }, 3000);
}

captureExperimentalFeatures().catch(console.error);
