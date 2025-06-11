import { chromium } from 'playwright';

async function testAnalyticsMock() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔗 Opening analytics directly...');
    await page.goto('http://127.0.0.1:5173/analytics');
    await page.waitForTimeout(3000);

    console.log('📸 Capturing analytics mock...');
    await page.screenshot({ 
      path: './tests/screenshots/analytics-mock.png',
      fullPage: true
    });

    console.log('✅ Analytics mock test completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await browser.close();
  }
}

testAnalyticsMock();