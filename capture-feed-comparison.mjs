import { chromium } from '@playwright/test';

async function captureFeedComparison() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  console.log('1. Going to app...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');

  // Check if we need to login
  const needsLogin = await page.locator('input[placeholder="Username or email"]').count() > 0;
  
  if (needsLogin) {
    console.log('2. Logging in...');
    await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
  } else {
    console.log('2. Already logged in');
  }
  
  // Wait for feed to load
  await page.waitForSelector('.feed-container', { timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('3. Capturing original feed...');
  await page.screenshot({ 
    path: 'tests/feed-original.png', 
    fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });

  console.log('4. Navigating to Tailwind feed...');
  await page.goto('http://127.0.0.1:5173/tailwind-feed');
  await page.waitForSelector('.feed-container', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  console.log('5. Capturing Tailwind feed...');
  await page.screenshot({ 
    path: 'tests/feed-tailwind.png', 
    fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  });

  await browser.close();
  console.log('\n✅ Feed comparison screenshots captured!');
  console.log('📁 Original: tests/feed-original.png');
  console.log('📁 Tailwind: tests/feed-tailwind.png');
}

captureFeedComparison().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});