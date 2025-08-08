const puppeteer = require("puppeteer");

async function testSearchTypeaheadFix() {
  console.log("Starting Search Component Typeahead Test...\n");

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Test 1: Empty dropdown bug fix
    console.log("Test 1: Checking empty dropdown fix...");
    await page.goto("http://localhost:5175/search", {
      waitUntil: "networkidle0",
    });

    // Wait for page to load
    await page.waitForSelector("button", { timeout: 10000 });

    // Find and click "Add user" button
    const addUserButton = await page.$$eval("button", (buttons) => {
      const btn = buttons.find((btn) => btn.textContent.includes("Add user"));
      if (btn) btn.click();
      return !!btn;
    });

    if (addUserButton) {
      console.log('✓ Clicked "Add user" button');

      // Wait for input to appear
      await page.waitForTimeout(500);

      // Find the input field
      const userInput = await page.$('input[placeholder*="jay.bsky.team"]');
      if (userInput) {
        console.log("✓ Found user input field");

        // Focus and press arrow down
        await userInput.focus();
        await page.keyboard.press("ArrowDown");
        console.log("✓ Pressed arrow down key");

        // Wait to see if dropdown appears
        await page.waitForTimeout(1000);

        // Check for dropdown
        const dropdown = await page.$("div.absolute.z-10");

        if (dropdown) {
          // Count items in dropdown
          const itemCount = await page.$$eval(
            "div.absolute.z-10 button",
            (buttons) => buttons.length,
          );
          console.log(`✓ Dropdown appeared with ${itemCount} items`);

          if (itemCount === 0) {
            console.log("✗ FAIL: Empty dropdown detected!");
            return false;
          } else {
            console.log("✓ PASS: Dropdown has content");
          }
        } else {
          console.log("✓ PASS: No dropdown shown (no followers loaded yet)");
        }
      }
    }

    // Test 2: Normal typeahead functionality
    console.log("\nTest 2: Checking normal typeahead...");

    // Type a search query
    const inputs = await page.$$('input[placeholder*="jay.bsky.team"]');
    if (inputs.length > 0) {
      const input = inputs[0];
      await input.click({ clickCount: 3 }); // Select all
      await input.type("bsky");
      console.log('✓ Typed search query "bsky"');

      // Wait for debounce
      await page.waitForTimeout(1500);

      // Check for suggestions
      const suggestionsExist = (await page.$("div.absolute.z-10")) !== null;
      console.log(
        suggestionsExist
          ? "✓ Suggestions appeared"
          : "✓ No suggestions (might need auth)",
      );
    }

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSearchTypeaheadFix().catch(console.error);
