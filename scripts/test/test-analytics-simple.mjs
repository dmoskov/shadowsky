import { chromium } from 'playwright';
import fs from 'fs/promises';

async function testAnalyticsSimple() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Read credentials
    const credentials = await fs.readFile('.test-credentials', 'utf-8');
    const lines = credentials.split('\n');
    const username = lines.find(l => l.startsWith('TEST_USER=')).split('=')[1];
    const password = lines.find(l => l.startsWith('TEST_PASS=')).split('=')[1];
    
    console.log('Opening app...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Login
    console.log('Logging in...');
    await page.fill('input[placeholder*="Username"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Login")');
    await page.waitForTimeout(3000);

    // Go to analytics
    console.log('Going to analytics...');
    await page.goto('http://127.0.0.1:5173/analytics');
    
    // Wait longer
    console.log('Waiting for analytics to load...');
    await page.waitForTimeout(10000);
    
    // Screenshot
    await page.screenshot({ 
      path: './tests/screenshots/analytics-simple.png',
      fullPage: true
    });
    
    console.log('Screenshot saved. Check browser console for errors.');
    console.log('Browser will stay open. Press Ctrl+C to close.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAnalyticsSimple();