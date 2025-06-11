import { chromium } from '@playwright/test';

async function captureLoginScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log('1. Capturing original Login component...');
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(2000);
  
  // Capture original state
  await page.screenshot({ 
    path: 'tests/screenshots/login-original.png',
    fullPage: true 
  });
  
  // Test error states
  console.log('2. Testing validation states...');
  
  // Click login without filling fields
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);
  
  await page.screenshot({ 
    path: 'tests/screenshots/login-original-validation.png',
    fullPage: true 
  });
  
  // Test focus states
  console.log('3. Testing focus states...');
  await page.focus('input[type="text"]');
  await page.screenshot({ 
    path: 'tests/screenshots/login-original-focus.png',
    fullPage: true 
  });
  
  console.log('Screenshots saved to tests/screenshots/');
  console.log('Keeping browser open for manual inspection...');
}

captureLoginScreenshots().catch(console.error);