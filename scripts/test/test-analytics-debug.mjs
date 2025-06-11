import { chromium } from 'playwright';
import fs from 'fs/promises';

async function testAnalyticsDebug() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser Error:', msg.text());
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.error('Page Error:', error.message);
  });

  try {
    console.log('🔗 Opening application...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Check if we need to log in
    const loginButton = await page.$('button:has-text("Login")');
    if (loginButton) {
      console.log('🔐 Logging in...');
      
      // Read credentials from .test-credentials
      const credentials = await fs.readFile('.test-credentials', 'utf-8');
      const lines = credentials.split('\n');
      const username = lines.find(l => l.startsWith('TEST_USER=')).split('=')[1];
      const password = lines.find(l => l.startsWith('TEST_PASS=')).split('=')[1];
      
      await page.fill('input[placeholder*="Username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Login")');
      await page.waitForTimeout(3000);
    }

    // Wait for feed to load
    console.log('⏳ Waiting for feed to load...');
    await page.waitForSelector('.post-card', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Navigate directly to analytics
    console.log('📊 Navigating to analytics...');
    await page.goto('http://127.0.0.1:5173/analytics');
    await page.waitForTimeout(3000);

    // Check for error state
    const errorText = await page.$('.analytics-error');
    if (errorText) {
      console.log('❌ Analytics page showing error');
      
      // Try clicking retry
      const retryButton = await page.$('button:has-text("Retry")');
      if (retryButton) {
        console.log('🔄 Clicking retry...');
        await retryButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Take screenshot
    await page.screenshot({ 
      path: './tests/screenshots/analytics-debug.png',
      fullPage: false
    });

    console.log('✅ Debug screenshot captured!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ 
      path: './tests/screenshots/analytics-debug-error.png',
      fullPage: true
    });
  } finally {
    // Keep browser open for manual debugging
    console.log('Browser will stay open for debugging. Close manually when done.');
  }
}

testAnalyticsDebug();