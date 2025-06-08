import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser console:', msg.type(), msg.text());
  });
  
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });
  
  await page.goto('http://127.0.0.1:5173/');
  
  // Wait for page to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'test-screenshots/like-button-test.png' });
  console.log('Screenshot saved to test-screenshots/like-button-test.png');
  
  // Check if logged in by looking for feed
  const feedExists = await page.locator('.feed-container').count();
  
  if (feedExists === 0) {
    console.log('Not logged in - looking for login form');
    const loginForm = await page.locator('form').count();
    const loginButton = await page.locator('button:has-text("Login")').count();
    if (loginForm > 0 || loginButton > 0) {
      console.log('Login form found, app is working but needs login');
      console.log('You need to be logged in to test the like button.');
      console.log('Please log in manually in the browser window that opened.');
    } else {
      console.log('ERROR: No feed or login form found');
    }
  } else {
    console.log('Feed found - checking for posts');
    
    // Find the first like button
    const likeButton = page.locator('.like-btn').first();
    const likeButtonExists = await likeButton.count();
    
    if (likeButtonExists > 0) {
      console.log('Like button found - clicking it');
      
      // Get initial like count
      const initialCount = await likeButton.locator('span').textContent();
      console.log('Initial like count:', initialCount);
      
      // Click the like button
      await likeButton.click();
      
      // Wait for potential update
      await page.waitForTimeout(2000);
      
      // Check if count changed
      const newCount = await likeButton.locator('span').textContent();
      console.log('New like count:', newCount);
      
      if (initialCount !== newCount) {
        console.log('SUCCESS: Like button is working!');
      } else {
        console.log('ISSUE: Like count did not change');
        
        // Check for any alerts
        page.on('dialog', async dialog => {
          console.log('Alert message:', dialog.message());
          await dialog.dismiss();
        });
      }
    } else {
      console.log('No like button found in feed');
    }
  }
  
  // Keep browser open for inspection
  console.log('\nBrowser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();