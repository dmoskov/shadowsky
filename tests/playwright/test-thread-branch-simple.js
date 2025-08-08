import { chromium } from "playwright";

async function testThreadBranchSimple() {
  const browser = await chromium.launch({
    headless: true,
    viewport: { width: 1400, height: 900 },
  });

  try {
    const page = await browser.newPage();

    // Navigate directly to a thread URL (assuming we're already logged in)
    // This is a test approach - in production we'd need to login first
    console.log("Testing thread branch diagram component...");

    // Navigate to the app
    await page.goto("http://127.0.0.1:5173/");

    // Take a screenshot of the current state
    await page.screenshot({
      path: "test-screenshots/thread-branch-current-state.png",
      fullPage: false,
    });

    console.log("Screenshot saved: thread-branch-current-state.png");
    console.log("Test completed");
  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    await browser.close();
  }
}

testThreadBranchSimple().catch(console.error);
