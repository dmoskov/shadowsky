import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function captureLongThreads() {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1400, height: 900 }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto('http://127.0.0.1:5173/');
  console.log('Navigated to login page');

  // Fill in login form with test credentials
const credentials = getTestCredentials();

  await page.fill('input[placeholder="Username or email"]', credentials.identifier);
  await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button[type="submit"]');
  console.log('Submitted login form');

  // Wait for feed to load
  await page.waitForSelector('.feed-container', { timeout: 10000 });
  console.log('Feed loaded successfully');

  // Wait for posts to stabilize
  await page.waitForTimeout(3000);

  // Strategy: Find posts with high reply counts
  const posts = await page.$$('.post-card');
  console.log(`Found ${posts.length} posts`);

  let threadFound = false;
  let screenshotCount = 0;

  // Look for posts with many replies
  for (let i = 0; i < Math.min(posts.length, 10); i++) {
    const post = posts[i];
    
    // Check reply count
    const replyCountElement = await post.$('.engagement-btn:first-child span');
    if (replyCountElement) {
      const replyCount = await replyCountElement.textContent();
      const count = parseInt(replyCount) || 0;
      
      if (count >= 5) { // Look for threads with at least 5 replies
        console.log(`Found post with ${count} replies`);
        
        // Click to view thread
        await post.click();
        
        // Wait for thread to load
        await page.waitForSelector('.thread-container', { timeout: 10000 });
        await page.waitForTimeout(2000); // Let thread fully render
        
        // Screenshot 1: Initial thread view
        await page.screenshot({ 
          path: `test-screenshots/long-thread-${++screenshotCount}-initial.png`,
          fullPage: false
        });
        console.log('Captured initial thread view');
        
        // Scroll down to see more replies
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(1000);
        
        // Screenshot 2: Scrolled view
        await page.screenshot({ 
          path: `test-screenshots/long-thread-${++screenshotCount}-scrolled.png`,
          fullPage: false
        });
        console.log('Captured scrolled thread view');
        
        // Scroll to bottom to see deep nesting
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        
        // Screenshot 3: Deep nesting view
        await page.screenshot({ 
          path: `test-screenshots/long-thread-${++screenshotCount}-deep.png`,
          fullPage: false
        });
        console.log('Captured deep thread view');
        
        // Try to find deeply nested replies
        const nestedReplies = await page.$$('.thread-post-nested.depth-3, .thread-post-nested.depth-4, .thread-post-nested.depth-5');
        if (nestedReplies.length > 0) {
          console.log(`Found ${nestedReplies.length} deeply nested replies`);
          
          // Scroll to a deeply nested reply
          await nestedReplies[0].scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          
          // Screenshot 4: Focus on deep nesting
          await page.screenshot({ 
            path: `test-screenshots/long-thread-${++screenshotCount}-deep-focus.png`,
            fullPage: false
          });
          console.log('Captured deep nesting focus');
        }
        
        // Screenshot 5: Full page capture
        await page.screenshot({ 
          path: `test-screenshots/long-thread-${++screenshotCount}-fullpage.png`,
          fullPage: true
        });
        console.log('Captured full thread page');
        
        threadFound = true;
        break;
      }
    }
  }

  if (!threadFound) {
    console.log('No long threads found in current feed, searching more...');
    
    // Scroll feed to load more posts
    await page.keyboard.press('Escape'); // Close any open thread
    await page.waitForTimeout(1000);
    
    // Scroll to load more posts
    for (let scroll = 0; scroll < 3; scroll++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
    }
    
    // Try again with newly loaded posts
    const morePosts = await page.$$('.post-card');
    console.log(`Found ${morePosts.length} total posts after scrolling`);
    
    // Just capture any thread as example
    if (morePosts.length > 5) {
      await morePosts[5].click();
      await page.waitForSelector('.thread-container', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: `test-screenshots/long-thread-example.png`,
        fullPage: true
      });
      console.log('Captured example thread');
    }
  }

  // Close browser after a delay
  setTimeout(async () => {
    await browser.close();
    console.log('Capture completed');
  }, 3000);
}

captureLongThreads().catch(console.error);