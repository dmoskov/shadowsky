import { chromium } from 'playwright';

async function testLoggedInImprovements() {
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

    // Take screenshot of improved desktop feed
    console.log('📸 Desktop feed with improvements...');
    await page.screenshot({ 
      path: './tests/screenshots/improvements-feed-desktop.png',
      fullPage: false
    });

    // Test mobile viewport
    console.log('📱 Testing mobile improvements...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/improvements-feed-mobile.png',
      fullPage: false
    });

    // Test tablet viewport  
    console.log('💻 Testing tablet improvements...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/improvements-feed-tablet.png',
      fullPage: false
    });

    // Test post interactions on desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // Test hover states
    console.log('🎯 Testing hover interactions...');
    const firstPost = await page.$('.post-card');
    if (firstPost) {
      await firstPost.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: './tests/screenshots/improvements-hover-state.png',
        fullPage: false
      });
    }

    // Test engagement buttons
    console.log('💗 Testing engagement buttons...');
    const likeButton = await page.$('.like-btn');
    if (likeButton) {
      await likeButton.hover();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: './tests/screenshots/improvements-engagement-hover.png',
        fullPage: false
      });
    }

    console.log('✅ Improvement screenshots captured successfully!');
    console.log('   Screenshots saved in ./tests/screenshots/');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ 
      path: './tests/screenshots/improvements-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testLoggedInImprovements();