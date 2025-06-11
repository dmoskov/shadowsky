import { chromium } from '@playwright/test';

import { getTestCredentials } from '../src/lib/test-credentials.js';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log('Navigating to official Bluesky...');
  await page.goto('https://bsky.app/');
  
  // Login
  await page.waitForTimeout(2000);
  console.log('Logging in...');
  
  try {
    // Look for sign in button
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Fill login form
const credentials = getTestCredentials();

    await page.locator('input[type="text"], input[type="email"]').first().fill(credentials.identifier);
    await page.locator('input[type="password"]').first().fill('C%;,!2iO"]Wu%11T9+Y8');
    await page.locator('button[type="submit"]').first().click();
  } catch (e) {
    console.log('Login form may have changed');
  }
  
  console.log('Waiting for feed to load...');
  await page.waitForTimeout(5000);
  
  // Take remaining screenshots with error handling
  const screenshots = [
    { 
      name: '05-compose-button', 
      description: 'Compose button area',
      action: async () => {
        const composeBtn = page.locator('button').filter({ hasText: /new post|compose|write/i }).first();
        if (await composeBtn.isVisible()) {
          await composeBtn.scrollIntoViewIfNeeded();
        }
      }
    },
    { 
      name: '06-sidebar-navigation', 
      description: 'Sidebar navigation',
      action: async () => {
        // Just capture the current state with sidebar
      }
    },
    { 
      name: '07-post-details', 
      description: 'Post engagement details',
      action: async () => {
        // Click on a post to see details
        const post = page.locator('article').first();
        if (await post.isVisible()) {
          await post.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    { 
      name: '08-profile-hover', 
      description: 'Profile hover state',
      action: async () => {
        // Go back to feed
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        
        // Hover over a profile
        const profileLink = page.locator('a[href*="/profile/"]').first();
        if (await profileLink.isVisible()) {
          await profileLink.hover();
          await page.waitForTimeout(500);
        }
      }
    },
    { 
      name: '09-mobile-view', 
      description: 'Mobile responsive view',
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
        path: `progress/screenshots/official-${screenshot.name}.png`,
        fullPage: false
      });
    } catch (error) {
      console.log(`Failed to capture ${screenshot.name}:`, error.message);
    }
  }
  
  console.log('Screenshots saved to progress/screenshots/');
  console.log('Keeping browser open for manual exploration...');
  
  // Keep open for exploration
  await page.waitForTimeout(300000); // 5 minutes
  await browser.close();
})();