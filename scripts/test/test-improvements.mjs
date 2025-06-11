import { chromium } from 'playwright';

async function testImprovements() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔗 Opening application...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Take screenshot of current state
    console.log('📸 Taking screenshot of improved feed...');
    await page.screenshot({ 
      path: './tests/screenshots/improvements-desktop.png',
      fullPage: true
    });

    // Test mobile viewport
    console.log('📱 Testing mobile viewport...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/improvements-mobile.png',
      fullPage: true
    });

    // Test tablet viewport
    console.log('💻 Testing tablet viewport...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/improvements-tablet.png',
      fullPage: true
    });

    console.log('✅ Screenshots captured successfully!');
    console.log('   - Desktop: ./tests/screenshots/improvements-desktop.png');
    console.log('   - Mobile: ./tests/screenshots/improvements-mobile.png');
    console.log('   - Tablet: ./tests/screenshots/improvements-tablet.png');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await browser.close();
  }
}

testImprovements();