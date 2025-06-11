import { chromium } from '@playwright/test';

async function debugAppState() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  console.log('1. Going to app...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(3000);
  
  console.log('2. Taking screenshot of current state...');
  await page.screenshot({ path: 'tests/debug-current-state.png' });
  
  // Try to find what's on the page
  const hasLogin = await page.locator('input[placeholder="Username or email"]').count() > 0;
  const hasFeed = await page.locator('.feed-container').count() > 0;
  const hasLoading = await page.locator('.loading-container').count() > 0;
  const hasError = await page.locator('.error').count() > 0;
  
  console.log('Page state:');
  console.log('- Has login form:', hasLogin);
  console.log('- Has feed container:', hasFeed);
  console.log('- Has loading indicator:', hasLoading);
  console.log('- Has error:', hasError);
  
  // Get page title
  const title = await page.title();
  console.log('- Page title:', title);
  
  // Get any visible text
  const bodyText = await page.locator('body').innerText();
  console.log('- Visible text preview:', bodyText.substring(0, 200) + '...');
  
  await browser.close();
}

debugAppState().catch(err => {
  console.error('Error:', err);
});