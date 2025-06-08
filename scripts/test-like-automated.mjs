import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}]`, text);
    } else if (text.includes('Like') || text.includes('Session') || text.includes('Agent')) {
      console.log(`[${type}]`, text);
    }
  });
  
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });
  
  console.log('Navigating to Bluesky client...');
  await page.goto('http://127.0.0.1:5173/');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Check if we need to login
  const loginButton = await page.locator('button:has-text("Login")').count();
  
  if (loginButton > 0) {
    console.log('Login required, logging in with test credentials...');
    
    // Fill in credentials
    await page.fill('input[type="text"], input[type="email"], input[placeholder*="sername"], input[placeholder*="mail"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    
    // Click login
    await page.click('button:has-text("Login")');
    
    // Wait for login to complete
    console.log('Waiting for login to complete...');
    await page.waitForTimeout(5000);
  }
  
  // Check if we're now logged in
  const feedExists = await page.locator('.feed-container').count();
  
  if (feedExists === 0) {
    console.log('ERROR: Still not logged in after login attempt');
    await page.screenshot({ path: 'test-screenshots/login-failed.png' });
  } else {
    console.log('Successfully logged in, looking for posts...');
    
    // Wait for posts to load
    await page.waitForTimeout(2000);
    
    // Find the first like button
    const likeButtons = await page.locator('.like-btn').count();
    console.log(`Found ${likeButtons} like buttons`);
    
    if (likeButtons > 0) {
      // Find a like button with 0 likes (not already liked)
      let targetBtn = null;
      
      for (let i = 0; i < Math.min(likeButtons, 10); i++) {
        const btn = page.locator('.like-btn').nth(i);
        const text = await btn.textContent();
        if (text === '0') {
          targetBtn = btn;
          console.log(`Found unliked post at position ${i}`);
          break;
        }
      }
      
      if (!targetBtn) {
        console.log('All posts appear to be liked, using first button');
        targetBtn = page.locator('.like-btn').first();
      }
      
      const firstLikeBtn = targetBtn;
      
      // Get initial state
      const initialText = await firstLikeBtn.textContent();
      console.log('Initial like button text:', initialText);
      
      // Scroll the button into view
      await firstLikeBtn.scrollIntoViewIfNeeded();
      
      // Click the like button
      console.log('Clicking like button...');
      await firstLikeBtn.click();
      
      // Wait for potential update
      await page.waitForTimeout(5000);
      
      // Check for the "Updating post with real like URI" message
      await page.waitForTimeout(1000);
      
      // Check if anything changed
      const newText = await firstLikeBtn.textContent();
      console.log('New like button text:', newText);
      
      // Take a screenshot
      await page.screenshot({ path: 'test-screenshots/after-like-click.png' });
      
      if (initialText !== newText) {
        console.log('SUCCESS: Like button updated!');
      } else {
        console.log('ISSUE: Like button did not update');
        console.log('Check the browser console for error messages');
      }
    } else {
      console.log('No like buttons found in feed');
      await page.screenshot({ path: 'test-screenshots/no-like-buttons.png' });
    }
  }
  
  // Keep browser open for inspection
  console.log('\nBrowser will stay open for 60 seconds for inspection...');
  console.log('Check the Developer Console for any error messages.');
  await page.waitForTimeout(60000);
  
  await browser.close();
})();