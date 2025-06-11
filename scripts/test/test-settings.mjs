import { chromium } from 'playwright';

async function testSettings() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔗 Opening application...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Check if we need to log in
    const loginButton = await page.$('button:has-text("Login")');
    if (loginButton) {
      console.log('🔐 Logging in...');
      await page.fill('input[placeholder*="Username"]', 'bskyclienttest.bsky.social');
      await page.fill('input[type="password"]', 'test-app-1234');
      await page.click('button:has-text("Login")');
      await page.waitForTimeout(3000);
    }

    // Wait for feed to load
    console.log('⏳ Waiting for feed to load...');
    await page.waitForTimeout(2000);

    // Click on profile dropdown
    console.log('👤 Opening profile dropdown...');
    await page.click('.user-menu-trigger');
    await page.waitForTimeout(500);

    // Take screenshot of dropdown
    await page.screenshot({ 
      path: './tests/screenshots/settings-dropdown.png',
      fullPage: false
    });

    // Click on Settings
    console.log('⚙️ Navigating to settings...');
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(2000);

    // Take screenshot of settings page
    console.log('📸 Capturing settings page...');
    await page.screenshot({ 
      path: './tests/screenshots/settings-page.png',
      fullPage: false
    });

    // Test different tabs
    console.log('🗂️ Testing settings tabs...');
    
    // Feed tab
    await page.click('button:has-text("Feed")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: './tests/screenshots/settings-feed.png',
      fullPage: false
    });

    // Threads tab
    await page.click('button:has-text("Threads")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: './tests/screenshots/settings-threads.png',
      fullPage: false
    });

    // Muted words tab
    await page.click('button:has-text("Muted Words")');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: './tests/screenshots/settings-muted.png',
      fullPage: false
    });

    console.log('✅ Settings screenshots captured!');
    console.log('   - Dropdown: ./tests/screenshots/settings-dropdown.png');
    console.log('   - Main page: ./tests/screenshots/settings-page.png');
    console.log('   - Feed tab: ./tests/screenshots/settings-feed.png');
    console.log('   - Threads tab: ./tests/screenshots/settings-threads.png');
    console.log('   - Muted words: ./tests/screenshots/settings-muted.png');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ 
      path: './tests/screenshots/settings-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testSettings();