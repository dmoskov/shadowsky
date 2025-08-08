import { chromium } from "playwright";

async function debugLogin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then((c) => c.newPage());

  try {
    console.log("🔍 Debugging login page...");

    await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Check what inputs are available
    const inputs = await page.locator("input").all();
    console.log(`\nFound ${inputs.length} input fields:`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const name = await input.getAttribute("name");
      const type = await input.getAttribute("type");
      const placeholder = await input.getAttribute("placeholder");
      console.log(
        `  ${i + 1}. name="${name}", type="${type}", placeholder="${placeholder}"`,
      );
    }

    // Check for form and buttons
    const forms = await page.locator("form").count();
    const buttons = await page.locator("button").count();
    console.log(`\nForms: ${forms}, Buttons: ${buttons}`);

    // Take screenshot
    await page.screenshot({
      path: "test-screenshots/debug-login.png",
      fullPage: true,
    });
    console.log("\n📸 Screenshot saved: debug-login.png");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log(
      "\n👀 Browser left open for inspection. Close manually when done.",
    );
  }
}

debugLogin().catch(console.error);
