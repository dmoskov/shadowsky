import { chromium } from '@playwright/test';

async function captureComparison() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  console.log('1. Going to login page...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');

  console.log('2. Logging in...');
  await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
  await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button[type="submit"]');
  
  // Wait for feed to load
  try {
    await page.waitForSelector('.feed-container', { timeout: 30000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Feed not loaded, continuing...');
  }

  console.log('3. Navigating to comparison page...');
  await page.goto('http://127.0.0.1:5173/tailwind-test');
  await page.waitForTimeout(2000);
  
  console.log('4. Capturing comparison screenshot...');
  await page.screenshot({ 
    path: 'tests/postcard-comparison.png', 
    fullPage: true 
  });

  await browser.close();
  console.log('\n✅ Comparison screenshot captured!');
  console.log('📁 View at: tests/postcard-comparison.png');
}

captureComparison().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});