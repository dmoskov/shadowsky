import { chromium } from '@playwright/test';

async function checkTailwind() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('1. Navigating to Tailwind test page...');
  await page.goto('http://127.0.0.1:5173/tailwind-test');
  await page.waitForTimeout(2000);
  
  // Check if the blue box has the correct background
  const blueBox = await page.locator('.bg-blue-500').first();
  const bgColor = await blueBox.evaluate(el => window.getComputedStyle(el).backgroundColor);
  
  // Check if text is sized correctly
  const title = await page.locator('.text-3xl').first();
  const fontSize = await title.evaluate(el => window.getComputedStyle(el).fontSize);
  
  console.log('\n2. Computed styles:');
  console.log('- Blue box background:', bgColor);
  console.log('- Title font size:', fontSize);
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/tailwind-working-test.png', fullPage: true });
  
  const isStyled = bgColor.includes('rgb') || bgColor.includes('oklch');
  const hasLargeFont = parseInt(fontSize) > 20;
  
  console.log('\n3. Results:');
  console.log('- Background styled:', isStyled);
  console.log('- Font sized:', hasLargeFont);
  
  if (isStyled && hasLargeFont) {
    console.log('\n✅ Tailwind v4 is working in the app\!');
  } else {
    console.log('\n❌ Tailwind styles are not being applied');
  }
  
  console.log('\n4. Screenshot saved to tests/screenshots/tailwind-working-test.png');
  console.log('Keeping browser open for inspection...');
}

checkTailwind().catch(console.error);
