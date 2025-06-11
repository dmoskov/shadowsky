const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Read test credentials
const credentialsPath = path.join(__dirname, '.test-credentials');
const credentials = fs.readFileSync(credentialsPath, 'utf8');
const [, username] = credentials.match(/TEST_USER=(.+)/) || [];
const [, password] = credentials.match(/TEST_PASS=(.+)/) || [];

async function captureScreenshots() {
  const screenshotDir = '/tmp/bsky-screenshots';
  
  // Ensure directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();

  // Helper to take screenshot
  async function capture(name, description) {
    console.log(`Capturing: ${name} - ${description}`);
    await page.waitForTimeout(1000); // Let animations settle
    await page.screenshot({ 
      path: path.join(screenshotDir, `${name}.png`),
      fullPage: false 
    });
  }

  try {
    // 1. Login screen
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await capture('01-login', 'Login screen');

    // 2. Log in
    console.log('Logging in...');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // 3. Home feed
    await capture('02-home-feed', 'Home feed with posts');

    // 4. Scroll to show more posts
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    await capture('03-feed-scrolled', 'Feed after scrolling');

    // 5. Click on a post to view thread
    const firstPost = await page.$('.post-card');
    if (firstPost) {
      await firstPost.click();
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1000);
      await capture('04-thread-view', 'Thread view with replies');
    }

    // 6. Navigate to a profile
    const authorName = await page.$('.post-author-name');
    if (authorName) {
      await authorName.click();
      await page.waitForSelector('.profile-page', { timeout: 5000 });
      await page.waitForTimeout(1000);
      await capture('05-profile-view', 'User profile page');
    }

    // 7. Back to home
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    // 8. Open compose modal
    const composeBtn = await page.$('.compose-fab');
    if (composeBtn) {
      await composeBtn.click();
      await page.waitForSelector('.compose-modal', { timeout: 5000 });
      await page.waitForTimeout(1000);
      await capture('06-compose-modal', 'Compose new post modal');
      
      // Close modal
      const closeBtn = await page.$('[aria-label="Close"]');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 9. Search page
    await page.goto('http://127.0.0.1:5173/search');
    await page.waitForTimeout(2000);
    await capture('07-search-page', 'Search interface');

    // 10. Notifications
    await page.goto('http://127.0.0.1:5173/notifications');
    await page.waitForTimeout(2000);
    await capture('08-notifications', 'Notifications page');

    // 11. Find post with media/embeds
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    // Try to find a post with media
    const mediaPost = await page.$('.post-media');
    if (mediaPost) {
      await mediaPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('09-post-with-media', 'Post with media attachments');
    }

    // 12. Find quoted post
    const quotedPost = await page.$('.quoted-post');
    if (quotedPost) {
      await quotedPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('10-quoted-post', 'Post with quoted content');
    }

    // 13. Error states - try to access non-existent profile
    await page.goto('http://127.0.0.1:5173/profile/nonexistentuser12345');
    await page.waitForTimeout(2000);
    await capture('11-error-state', 'Error state for non-existent profile');

    // 14. Mobile view
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await capture('12-mobile-feed', 'Mobile responsive view');

    // 15. Mobile navigation
    const mobileMenu = await page.$('[aria-label="Menu"]');
    if (mobileMenu) {
      await mobileMenu.click();
      await page.waitForTimeout(1000);
      await capture('13-mobile-menu', 'Mobile navigation menu');
    }

    console.log('\nScreenshot capture complete!');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    
    // List captured screenshots
    const screenshots = fs.readdirSync(screenshotDir);
    console.log('\nCaptured screenshots:');
    screenshots.forEach(file => {
      if (file.endsWith('.png')) {
        console.log(`- ${file}`);
      }
    });

  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

// Run the capture
captureScreenshots().catch(console.error);