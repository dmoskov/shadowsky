import { chromium } from 'playwright';

async function testThreadDisplay() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    
    // Login
    console.log('Logging in...');
    await page.fill('input[type="text"]', 'bskyclienttest.bsky.social');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    
    // Wait for feed
    await page.waitForSelector('.feed-posts', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // First, let's search for a popular account to follow
    console.log('Searching for accounts to follow...');
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.fill('paul.bsky.team');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Try to navigate to the profile
      const profileLink = await page.$('a[href*="paul.bsky.team"]');
      if (profileLink) {
        await profileLink.click();
        await page.waitForTimeout(2000);
        
        // Follow the account
        const followBtn = await page.$('button:has-text("Follow")');
        if (followBtn) {
          await followBtn.click();
          console.log('Followed an account');
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Go back to home feed
    console.log('Returning to home feed...');
    await page.click('a[href="/"]');
    await page.waitForTimeout(3000);
    
    // Refresh feed to get new posts
    const refreshBtn = await page.$('button:has-text("Refresh Feed")');
    if (refreshBtn) {
      console.log('Refreshing feed...');
      await refreshBtn.click();
      await page.waitForTimeout(3000);
    }
    
    // Now check for posts and threads
    const posts = await page.$$('.post-card');
    console.log(`Found ${posts.length} posts after following accounts`);
    
    // Look for parent posts in threads
    const parentPosts = await page.$$('.parent-post');
    console.log(`Found ${parentPosts.length} parent posts (threads)`);
    
    // Check parent post text
    if (parentPosts.length > 0) {
      console.log('\\nAnalyzing parent posts:');
      for (let i = 0; i < Math.min(3, parentPosts.length); i++) {
        const textElement = await parentPosts[i].$('.parent-post-text');
        if (textElement) {
          const text = await textElement.textContent();
          const hasPlaceholder = await textElement.$('.text-tertiary') !== null;
          console.log(`Parent post ${i + 1}:`);
          console.log(`  Text: "${text?.slice(0, 50)}..."`);
          console.log(`  Has [No text] placeholder: ${hasPlaceholder}`);
        }
      }
    }
    
    // Check UI smoothness
    console.log('\\nTesting UI interactions:');
    if (posts.length > 0) {
      // Test hover on regular post
      await posts[0].hover();
      const hoverStyle = await posts[0].evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          transform: computed.transform,
          boxShadow: computed.boxShadow,
          borderColor: computed.borderColor
        };
      });
      console.log('Post hover styles:', hoverStyle);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-screenshots/feed-final-state.png',
      fullPage: true 
    });
    console.log('\\nScreenshot saved to test-screenshots/feed-final-state.png');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ 
      path: 'test-screenshots/error-state-threads.png',
      fullPage: true 
    });
  }
  
  // Keep browser open for observation
  await page.waitForTimeout(5000);
  await browser.close();
}

testThreadDisplay().catch(console.error);