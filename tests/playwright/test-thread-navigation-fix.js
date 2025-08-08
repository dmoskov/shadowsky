import { chromium } from "playwright";

import { getTestCredentials } from "../../src/lib/test-credentials.js";
async function testThreadNavigationFix() {
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1400, height: 900 },
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto("http://127.0.0.1:5173/");
  console.log("Navigated to login page");

  // Fill in login form with test credentials
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

  // Wait for posts to stabilize
  await page.waitForTimeout(2000);

  // Find a post with replies
  const posts = await page.$$(".post-card");
  let threadFound = false;

  for (let i = 0; i < Math.min(posts.length, 10); i++) {
    const post = posts[i];

    // Check if post has replies
    const replyButton = await post.$(".engagement-btn:first-child");
    if (replyButton) {
      const replyText = await replyButton.textContent();
      const replyCount = parseInt(replyText.match(/\d+/)?.[0] || "0");

      console.log(`Post ${i + 1}: ${replyCount} replies`);

      if (replyCount > 0) {
        // Click to view thread
        await post.click();
        console.log(`Clicked post with ${replyCount} replies`);
        threadFound = true;
        break;
      }
    }
  }

  if (!threadFound) {
    // Just click the first post as fallback
    console.log("No posts with replies found, clicking first post");
    await posts[0].click();
  }

  // Wait for thread to load
  await page.waitForSelector(".thread-container", { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log("Thread view loaded");

  // Check if thread navigation is present
  const threadNav = await page.$(".thread-navigation");
  if (threadNav) {
    console.log("✅ Thread navigation component found");

    // Check participants section
    const participantsList = await page.$(".participant-list");
    if (participantsList) {
      // Get participants
      const participants = await page.$$(".participant-chip");
      console.log(`Found ${participants.length} participants in navigation`);

      if (participants.length > 0) {
        // Log participant info
        for (let i = 0; i < Math.min(participants.length, 3); i++) {
          const nameEl = await participants[i].$(".participant-name");
          const countEl = await participants[i].$(".participant-count");

          const name = (await nameEl?.textContent()) || "Unknown";
          const count = (await countEl?.textContent()) || "(0)";

          console.log(`  - ${name} ${count}`);
        }

        // Test clicking on a participant
        console.log("\nTesting participant navigation...");
        await participants[0].click();
        await page.waitForTimeout(1000);
        console.log("Clicked first participant");
      } else {
        // Check for no participants message
        const noParticipants = await page.$(".no-participants");
        if (noParticipants) {
          const message = await noParticipants.textContent();
          console.log(`No participants: ${message}`);
        }
      }
    }

    // Test keyboard navigation
    console.log("\nTesting keyboard navigation...");

    // Get initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY);

    // Press J to navigate down
    await page.keyboard.press("j");
    await page.waitForTimeout(500);
    const afterJ = await page.evaluate(() => window.scrollY);
    console.log(`Pressed J: scroll changed from ${initialScroll} to ${afterJ}`);

    // Press K to navigate up
    await page.keyboard.press("k");
    await page.waitForTimeout(500);
    const afterK = await page.evaluate(() => window.scrollY);
    console.log(`Pressed K: scroll changed from ${afterJ} to ${afterK}`);

    // Press H to go home
    await page.keyboard.press("h");
    await page.waitForTimeout(500);
    const afterH = await page.evaluate(() => window.scrollY);
    console.log(`Pressed H: scroll position ${afterH}`);

    // Take screenshot of working navigation
    await page.screenshot({
      path: "test-screenshots/thread-navigation-fixed.png",
      fullPage: false,
    });
    console.log("\nScreenshot saved: thread-navigation-fixed.png");
  } else {
    console.log("❌ Thread navigation component NOT found");

    // Take screenshot for debugging
    await page.screenshot({
      path: "test-screenshots/thread-navigation-missing.png",
      fullPage: false,
    });
  }

  // Check data attributes
  const postsWithUri = await page.$$("[data-post-uri]");
  const postsWithHandle = await page.$$("[data-author-handle]");
  console.log(`\nFound ${postsWithUri.length} posts with data-post-uri`);
  console.log(`Found ${postsWithHandle.length} posts with data-author-handle`);

  // Close browser after a delay
  setTimeout(async () => {
    await browser.close();
    console.log("\nThread navigation test completed");
  }, 3000);
}

testThreadNavigationFix().catch(console.error);
