import { chromium } from 'playwright';

async function testBlueskyClient() {
  const browser = await chromium.launch({ 
    headless: false, // Set to true for headless mode
    devtools: true 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    
    // Wait for login form
    console.log('Waiting for login form...');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    
    // Fill in credentials
    console.log('Entering credentials...');
    await page.fill('input[type="text"]', 'bskyclienttest.bsky.social');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    
    // Click login button
    console.log('Clicking login...');
    await page.click('button[type="submit"]');
    
    // Wait for feed to load
    console.log('Waiting for feed...');
    await page.waitForSelector('.feed-posts', { timeout: 10000 });
    
    // Wait a bit for posts to load or "no posts" message
    await page.waitForTimeout(3000);
    
    // Check for posts
    const posts = await page.$$('.post-card');
    console.log(`Found ${posts.length} posts in feed`);
    
    // Check if it's an empty feed
    const noMorePosts = await page.$('.no-more-posts');
    if (noMorePosts) {
      const text = await noMorePosts.textContent();
      console.log('Empty feed message:', text);
    }
    
    // Check for skeleton loaders
    const skeletons = await page.$$('.post-skeleton');
    console.log(`Found ${skeletons.length} skeleton loaders`);
    
    // Look for parent posts in threads
    const parentPosts = await page.$$('.parent-post');
    console.log(`Found ${parentPosts.length} parent posts`);
    
    // Check parent post text
    if (parentPosts.length > 0) {
      const parentPostTexts = await page.$$eval('.parent-post-text', elements => 
        elements.map(el => ({
          text: el.textContent,
          hasNoTextPlaceholder: el.querySelector('.text-tertiary') !== null
        }))
      );
      
      console.log('Parent post texts:', parentPostTexts);
    }
    
    // Check for UI smoothness by hovering over posts
    console.log('Testing hover effects...');
    if (posts.length > 0) {
      await posts[0].hover();
      await page.waitForTimeout(500);
    }
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check refresh button
    const refreshBtn = await page.$('button:has-text("Refresh Feed")');
    if (refreshBtn) {
      console.log('Refresh button found');
    }
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-screenshots/feed-with-threads.png',
      fullPage: true 
    });
    console.log('Screenshot saved to test-screenshots/feed-with-threads.png');
    
    // Check for console errors
    const errors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.error-message');
      return Array.from(errorElements).map(el => el.textContent);
    });
    
    if (errors.length > 0) {
      console.log('UI errors found:', errors);
    }
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ 
      path: 'test-screenshots/error-state.png',
      fullPage: true 
    });
  }
  
  // Keep browser open for 5 seconds to observe
  await page.waitForTimeout(5000);
  await browser.close();
}

testBlueskyClient().catch(console.error);