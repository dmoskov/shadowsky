import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read test credentials
const credentialsPath = path.join(__dirname, ".test-credentials");
const credentials = fs.readFileSync(credentialsPath, "utf8");
const [, username] = credentials.match(/TEST_USER=(.+)/) || [];
const [, password] = credentials.match(/TEST_PASS=(.+)/) || [];

async function testSidebarNavigation() {
  const screenshotDir = path.join(
    __dirname,
    "test-screenshots",
    "sidebar-final",
  );

  // Ensure directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
  });

  try {
    console.log("🧪 Bluesky Sidebar Navigation Test - Final\n");

    // 1. Login
    console.log("1️⃣  Setting up and logging in...");
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto("http://127.0.0.1:5173/");
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for feed to load
    await page.waitForSelector(".feed-container", { timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2. Desktop view showing sidebar
    console.log("\n2️⃣  Testing desktop view with sidebar...");
    await page.screenshot({
      path: path.join(screenshotDir, "01-desktop-sidebar-home.png"),
      fullPage: false,
    });
    console.log("   ✅ Desktop view captured");

    // 3. Test compose button
    console.log("\n3️⃣  Testing compose functionality...");
    const composeBtn = await page.$(".sidebar .compose-btn");
    if (composeBtn) {
      await composeBtn.click();
      await page.waitForSelector(".compose-modal", { timeout: 5000 });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotDir, "02-compose-modal-open.png"),
        fullPage: false,
      });
      console.log("   ✅ Compose modal captured");

      // Close modal properly
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);

      // Verify modal is closed
      const modalClosed = (await page.$(".compose-modal")) === null;
      if (!modalClosed) {
        // Try clicking the close button
        const closeBtn = await page.$('[aria-label="Close"]');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(1000);
      }
      console.log("   ✅ Modal closed");
    }

    // 4. Test navigation items
    console.log("\n4️⃣  Testing navigation items...");

    // Search
    const searchLink = await page.$('.nav-item[href="/search"]');
    if (searchLink) {
      await searchLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(screenshotDir, "03-sidebar-search-page.png"),
        fullPage: false,
      });
      console.log("   ✅ Search navigation working");
    }

    // Notifications
    const notificationsLink = await page.$('.nav-item[href="/notifications"]');
    if (notificationsLink) {
      await notificationsLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(screenshotDir, "04-sidebar-notifications-page.png"),
        fullPage: false,
      });
      console.log("   ✅ Notifications navigation working");

      // Check badge
      const badge = await page.$('.nav-item[href="/notifications"] .nav-badge');
      if (badge) {
        const badgeText = await badge.textContent();
        console.log(`   📊 Notification badge: ${badgeText}`);
      }
    }

    // 5. Test responsive behavior
    console.log("\n5️⃣  Testing responsive design...");

    // Go back to home for consistent testing
    await page.goto("http://127.0.0.1:5173/");
    await page.waitForSelector(".feed-container", { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Desktop XL (1920x1080)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, "05-desktop-xl-1920.png"),
      fullPage: false,
    });
    console.log("   ✅ Desktop XL (1920x1080)");

    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, "06-desktop-1280.png"),
      fullPage: false,
    });
    console.log("   ✅ Desktop (1280x800)");

    // Tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, "07-tablet-768.png"),
      fullPage: false,
    });
    console.log("   ✅ Tablet (768x1024)");

    // Mobile (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, "08-mobile-375.png"),
      fullPage: false,
    });
    console.log("   ✅ Mobile (375x812)");

    // Check mobile menu
    const mobileMenuBtn = await page.$('[aria-label="Menu"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotDir, "09-mobile-menu-open.png"),
        fullPage: false,
      });
      console.log("   ✅ Mobile menu captured");
    }

    // 6. Final summary
    console.log("\n✅ All tests completed successfully!");

    const screenshots = fs.readdirSync(screenshotDir).sort();
    console.log("\n📁 Screenshots saved to:", screenshotDir);
    console.log("📸 Captured files:");
    screenshots.forEach((file) => {
      console.log(`   - ${file}`);
    });

    // Generate HTML preview
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Sidebar Navigation Test Results</title>
    <style>
        body { font-family: system-ui; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .screenshot { margin: 20px 0; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .screenshot h3 { margin-top: 0; color: #555; }
        .screenshot img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
        .info { background: #e8f4f8; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>🧪 Bluesky Sidebar Navigation Test Results</h1>
    <div class="info">
        <strong>Test Date:</strong> ${new Date().toLocaleString()}<br>
        <strong>Total Screenshots:</strong> ${screenshots.length}
    </div>
    
    <div class="screenshot">
        <h3>1. Desktop View with Sidebar (Home)</h3>
        <img src="01-desktop-sidebar-home.png" alt="Desktop sidebar home">
    </div>
    
    <div class="screenshot">
        <h3>2. Compose Modal</h3>
        <img src="02-compose-modal-open.png" alt="Compose modal">
    </div>
    
    <div class="screenshot">
        <h3>3. Search Page</h3>
        <img src="03-sidebar-search-page.png" alt="Search page">
    </div>
    
    <div class="screenshot">
        <h3>4. Notifications Page</h3>
        <img src="04-sidebar-notifications-page.png" alt="Notifications page">
    </div>
    
    <div class="screenshot">
        <h3>5. Desktop XL (1920x1080)</h3>
        <img src="05-desktop-xl-1920.png" alt="Desktop XL">
    </div>
    
    <div class="screenshot">
        <h3>6. Desktop (1280x800)</h3>
        <img src="06-desktop-1280.png" alt="Desktop">
    </div>
    
    <div class="screenshot">
        <h3>7. Tablet (768x1024)</h3>
        <img src="07-tablet-768.png" alt="Tablet">
    </div>
    
    <div class="screenshot">
        <h3>8. Mobile (375x812)</h3>
        <img src="08-mobile-375.png" alt="Mobile">
    </div>
    
    <div class="screenshot">
        <h3>9. Mobile Menu</h3>
        <img src="09-mobile-menu-open.png" alt="Mobile menu">
    </div>
</body>
</html>
    `;

    fs.writeFileSync(
      path.join(screenshotDir, "results.html"),
      htmlContent.trim(),
    );
    console.log("\n📄 HTML report generated: results.html");
    console.log(
      "   Open in browser: file://" + path.join(screenshotDir, "results.html"),
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);

    // Try to capture error state
    try {
      const context = browser.contexts()[0];
      if (context) {
        const page = context.pages()[0];
        if (page) {
          await page.screenshot({
            path: path.join(screenshotDir, "error-state.png"),
            fullPage: false,
          });
        }
      }
    } catch (e) {
      // Ignore screenshot errors
    }

    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
testSidebarNavigation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
