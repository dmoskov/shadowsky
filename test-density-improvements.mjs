import { chromium } from 'playwright';

async function testDensityImprovements() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔗 Opening application...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Check if we need to log in
    const loginButton = await page.$('button:has-text("Login")');
    if (loginButton) {
      console.log('🔐 Logging in...');
      await page.fill('input[placeholder*="Username"]', 'bskyclienttest.bsky.social');
      await page.fill('input[type="password"]', 'test-app-1234');
      await page.click('button:has-text("Login")');
      await page.waitForTimeout(3000);
    }

    // Wait for feed to load
    console.log('⏳ Waiting for feed to load...');
    await page.waitForTimeout(3000);

    // Take screenshot of improved feed
    console.log('📸 Capturing improved feed density...');
    await page.screenshot({ 
      path: './tests/screenshots/density-improvements-feed.png',
      fullPage: false
    });

    // Try to navigate to a thread view
    console.log('🧵 Looking for thread to test...');
    const threadLinks = await page.$$('a[href*="/thread/"]');
    
    if (threadLinks.length > 0) {
      await threadLinks[0].click();
      await page.waitForTimeout(2000);
      
      console.log('📸 Capturing thread view improvements...');
      await page.screenshot({ 
        path: './tests/screenshots/density-improvements-thread.png',
        fullPage: false
      });

      // Test thread navigation
      console.log('🎛️ Testing thread navigation...');
      const navToggle = await page.$('.thread-nav-toggle');
      if (navToggle) {
        await navToggle.click();
        await page.waitForTimeout(500);
        
        await page.screenshot({ 
          path: './tests/screenshots/density-improvements-thread-nav.png',
          fullPage: false
        });
      }
    }

    // Test mobile viewport
    console.log('📱 Testing mobile density...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/density-improvements-mobile.png',
      fullPage: false
    });

    console.log('✅ Density improvement screenshots captured!');
    console.log('   - Feed: ./tests/screenshots/density-improvements-feed.png');
    console.log('   - Thread: ./tests/screenshots/density-improvements-thread.png');
    console.log('   - Navigation: ./tests/screenshots/density-improvements-thread-nav.png');
    console.log('   - Mobile: ./tests/screenshots/density-improvements-mobile.png');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ 
      path: './tests/screenshots/density-improvements-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testDensityImprovements();