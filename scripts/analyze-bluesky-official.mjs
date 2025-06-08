import { chromium } from '@playwright/test';

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
  console.log('Looking for login form...');
  
  // Try different selectors for the login form
  try {
    // First try the sign in button if we're on the landing page
    const signInBtn = page.locator('button:has-text("Sign in")');
    if (await signInBtn.count() > 0) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Now fill in the login form
    // Try multiple possible selectors
    const identifierInput = page.locator('input[name="identifier"], input[placeholder*="Email"], input[placeholder*="Username"], input[type="email"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    
    await identifierInput.fill('traviskimmel+bsky@gmail.com');
    await passwordInput.fill('C%;,!2iO"]Wu%11T9+Y8');
    
    // Find and click the submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Next")').first();
    await submitBtn.click();
  } catch (error) {
    console.log('Login selectors may have changed, trying alternative approach...');
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'progress/screenshots/login-debug.png' });
    throw error;
  }
  
  console.log('Waiting for login...');
  await page.waitForTimeout(5000);
  
  // Take screenshots of different areas
  const screenshots = [
    { name: '01-feed-view', description: 'Main feed view' },
    { name: '02-post-interactions', description: 'Post with likes/reposts' },
    { name: '03-thread-view', description: 'Thread conversation', action: async () => {
      // Click on a post with replies
      const postWithReplies = page.locator('div[data-testid="postThreadItem"]').first();
      if (await postWithReplies.count() > 0) {
        await postWithReplies.click();
        await page.waitForTimeout(2000);
      }
    }},
    { name: '04-quote-post', description: 'Quote post example', action: async () => {
      // Close any open dialogs first
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch {}
      
      // Go back to home
      const homeLink = page.locator('a[aria-label="Home"]');
      if (await homeLink.isVisible()) {
        await homeLink.click();
        await page.waitForTimeout(2000);
      }
      
      // Find a quote post
      const quotePost = page.locator('div[data-testid="quotePost"]').first();
      if (await quotePost.count() > 0) {
        await quotePost.scrollIntoViewIfNeeded();
      }
    }},
    { name: '05-compose-modal', description: 'Compose post modal', action: async () => {
      await page.click('button[aria-label="Compose post"]');
      await page.waitForTimeout(1000);
    }},
    { name: '06-profile-view', description: 'Profile page', action: async () => {
      await page.keyboard.press('Escape');
      await page.click('a[aria-label="Profile"]');
      await page.waitForTimeout(2000);
    }},
    { name: '07-notifications', description: 'Notifications view', action: async () => {
      await page.click('a[aria-label="Notifications"]');
      await page.waitForTimeout(2000);
    }},
    { name: '08-search', description: 'Search interface', action: async () => {
      await page.click('a[aria-label="Search"]');
      await page.waitForTimeout(2000);
    }},
    { name: '09-settings', description: 'Settings page', action: async () => {
      await page.click('button[aria-label="Settings"]');
      await page.waitForTimeout(1000);
    }},
    { name: '10-mobile-responsive', description: 'Mobile view', action: async () => {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1000);
    }}
  ];
  
  console.log('Taking screenshots of official Bluesky...');
  
  for (const screenshot of screenshots) {
    console.log(`Capturing: ${screenshot.description}`);
    
    if (screenshot.action) {
      await screenshot.action();
    }
    
    await page.screenshot({ 
      path: `progress/screenshots/official-${screenshot.name}.png`,
      fullPage: false
    });
  }
  
  console.log('Screenshots saved to progress/screenshots/official-*.png');
  console.log('Browser will remain open for manual exploration...');
  
  // Keep open for manual exploration
  await page.waitForTimeout(300000); // 5 minutes
  await browser.close();
})();