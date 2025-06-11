import { chromium } from 'playwright';
import fs from 'fs/promises';

async function testAnalyticsConsole() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push(`[${type}] ${text}`);
    console.log(`Browser ${type}:`, text);
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleMessages.push(`[ERROR] ${error.message}`);
    console.error('Page Error:', error.message);
  });

  // Capture request failures
  page.on('requestfailed', request => {
    consoleMessages.push(`[REQUEST FAILED] ${request.url()}: ${request.failure()?.errorText}`);
    console.error('Request failed:', request.url(), request.failure()?.errorText);
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
    
    // Clear console messages from initial load
    consoleMessages.length = 0;
    
    // Navigate to analytics
    console.log('📊 Navigating to analytics...');
    await page.goto('http://127.0.0.1:5173/analytics');
    await page.waitForTimeout(5000);

    // Save console messages
    console.log('\n📋 Console Messages:');
    consoleMessages.forEach(msg => console.log(msg));
    
    await fs.writeFile('./tests/analytics-console-log.txt', consoleMessages.join('\n'));

    // Take screenshot
    await page.screenshot({ 
      path: './tests/screenshots/analytics-console-test.png',
      fullPage: false
    });

    console.log('\n✅ Console log saved to ./tests/analytics-console-log.txt');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    console.log('\nKeeping browser open with DevTools. Close manually when done.');
  }
}

testAnalyticsConsole();