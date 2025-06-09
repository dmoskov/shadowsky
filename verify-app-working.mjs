import { chromium } from '@playwright/test';

async function verifyApp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  console.log('1. Going to app...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(2000);
  
  // Check what's on the page
  const hasLogin = await page.locator('input[placeholder="Username or email"]').count() > 0;
  const hasFeed = await page.locator('.feed-container').count() > 0;
  const hasTwFeed = await page.locator('.tw-feed-container').count() > 0;
  
  console.log('Page status:');
  console.log('- Has login form:', hasLogin);
  console.log('- Has regular feed:', hasFeed);
  console.log('- Has Tailwind feed:', hasTwFeed);
  
  console.log('\n2. Taking screenshot...');
  await page.screenshot({ path: 'tests/app-current-state.png' });
  
  // Try to navigate to our test pages
  console.log('\n3. Checking style guide...');
  await page.goto('http://127.0.0.1:5173/tailwind-style-guide.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/style-guide-check.png' });
  
  console.log('\n4. Checking comparison page...');
  await page.goto('http://127.0.0.1:5173/tailwind-test');
  await page.waitForTimeout(1000);
  const hasComparison = await page.locator('h1:has-text("PostCard Migration Comparison")').count() > 0;
  console.log('- Has comparison page:', hasComparison);
  
  await browser.close();
  console.log('\n✅ Verification complete!');
  console.log('Check screenshots in tests/ directory');
}

verifyApp().catch(err => {
  console.error('❌ Error:', err);
});