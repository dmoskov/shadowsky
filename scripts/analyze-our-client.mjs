import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log('Navigating to our Bluesky client...');
  await page.goto('http://127.0.0.1:5173/');
  
  // Login
  await page.waitForTimeout(2000);
  console.log('Logging in...');
  
  await page.fill('input[type="text"], input[type="email"]', 'traviskimmel+bsky@gmail.com');
  await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button:has-text("Login")');
  
  console.log('Waiting for feed to load...');
  await page.waitForTimeout(5000);
  
  // Take comparable screenshots
  const screenshots = [
    { name: '01-feed-view', description: 'Main feed view' },
    { name: '02-post-interactions', description: 'Post with likes/reposts' },
    { 
      name: '03-thread-view', 
      description: 'Thread conversation',
      action: async () => {
        // Click on a post
        const post = page.locator('.post-card').first();
        if (await post.isVisible()) {
          await post.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    { 
      name: '04-compose-modal', 
      description: 'Compose modal',
      action: async () => {
        // Click compose button
        const composeBtn = page.locator('button:has-text("Compose")');
        if (await composeBtn.isVisible()) {
          await composeBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    },
    { 
      name: '05-sidebar', 
      description: 'Sidebar navigation',
      action: async () => {
        // Close modal if open
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    },
    { 
      name: '06-profile', 
      description: 'Profile view',
      action: async () => {
        const profileLink = page.locator('a[href*="/profile"]').first();
        if (await profileLink.isVisible()) {
          await profileLink.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    { 
      name: '07-notifications', 
      description: 'Notifications',
      action: async () => {
        const notifLink = page.locator('a:has-text("Notifications")');
        if (await notifLink.isVisible()) {
          await notifLink.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    { 
      name: '08-search', 
      description: 'Search interface',
      action: async () => {
        const searchLink = page.locator('a:has-text("Search")');
        if (await searchLink.isVisible()) {
          await searchLink.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    { 
      name: '09-mobile-view', 
      description: 'Mobile view',
      action: async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(1000);
      }
    },
    { 
      name: '10-desktop-wide', 
      description: 'Wide desktop view',
      action: async () => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(1000);
      }
    }
  ];
  
  for (const screenshot of screenshots) {
    try {
      console.log(`Capturing: ${screenshot.description}`);
      
      if (screenshot.action) {
        await screenshot.action();
      }
      
      await page.screenshot({ 
        path: `progress/screenshots/our-${screenshot.name}.png`,
        fullPage: false
      });
    } catch (error) {
      console.log(`Failed to capture ${screenshot.name}:`, error.message);
    }
  }
  
  console.log('Screenshots saved to progress/screenshots/our-*.png');
  console.log('Analysis complete!');
  
  await page.waitForTimeout(5000);
  await browser.close();
})();