import { chromium } from '@playwright/test';

async function checkTailwind() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('1. Loading Tailwind test page...');
  await page.goto('http://127.0.0.1:5173/test-tailwind-minimal.html');
  await page.waitForTimeout(2000);
  
  // Check if elements have Tailwind styles applied
  const blueDiv = await page.locator('.bg-blue-500').first();
  const bgColor = await blueDiv.evaluate(el => window.getComputedStyle(el).backgroundColor);
  
  const title = await page.locator('.text-3xl').first();
  const fontSize = await title.evaluate(el => window.getComputedStyle(el).fontSize);
  
  console.log('\n2. Checking computed styles:');
  console.log('- Blue div background:', bgColor);
  console.log('- Title font size:', fontSize);
  
  // Check if it's actually styled
  const isStyled = bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent';
  const hasLargeFont = parseInt(fontSize) > 20;
  
  console.log('\n3. Results:');
  console.log('- Background styled:', isStyled);
  console.log('- Font sized:', hasLargeFont);
  
  await page.screenshot({ path: 'tests/tailwind-test-check.png' });
  
  await browser.close();
  
  if (isStyled && hasLargeFont) {
    console.log('\n✅ Tailwind is working!');
  } else {
    console.log('\n❌ Tailwind is NOT working - classes are not generating styles');
  }
}

checkTailwind().catch(console.error);