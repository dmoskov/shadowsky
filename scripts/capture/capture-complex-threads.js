import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function captureComplexThreads() {
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

  // First, let's navigate to the thread we just saw
  const threadLink = await page.$('a[href*="/thread/"]');
  if (threadLink) {
    await threadLink.click();
    await page.waitForSelector('.thread-container', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Capture different states of this thread
    console.log('Capturing thread UI states...');
    
    // State 1: Initial load (top of thread)
    await page.screenshot({ 
      path: 'test-screenshots/thread-ui-1-initial.png',
      fullPage: false
    });
    console.log('1. Captured initial thread state');
    
    // State 2: Scroll to show thread lines and nesting
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'test-screenshots/thread-ui-2-nesting.png',
      fullPage: false
    });
    console.log('2. Captured thread nesting');
    
    // State 3: Look for collapsed or deep threads
    const deepReplies = await page.$$('.thread-post-nested');
    if (deepReplies.length > 0) {
      console.log(`Found ${deepReplies.length} nested replies`);
      
      // Focus on nested area
      if (deepReplies.length > 2) {
        await deepReplies[2].scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ 
          path: 'test-screenshots/thread-ui-3-deep-nesting.png',
          fullPage: false
        });
        console.log('3. Captured deep nesting');
      }
    }
    
    // State 4: Bottom of thread
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'test-screenshots/thread-ui-4-bottom.png',
      fullPage: false
    });
    console.log('4. Captured bottom of thread');
    
    // State 5: Full page for complete context
    await page.screenshot({ 
      path: 'test-screenshots/thread-ui-5-fullpage.png',
      fullPage: true
    });
    console.log('5. Captured full thread page');
    
    // State 6: Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro size
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'test-screenshots/thread-ui-6-mobile.png',
      fullPage: false
    });
    console.log('6. Captured mobile view');
    
    // Reset viewport
    await page.setViewportSize({ width: 1400, height: 900 });
  }

  // Try to find a different thread with more complexity
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForSelector('.feed-container', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Look for posts with quoted posts or complex embeds
  const quotedPosts = await page.$$('.quoted-post');
  if (quotedPosts.length > 0) {
    console.log(`Found ${quotedPosts.length} quoted posts`);
    
    // Click on parent of first quoted post
    const parentCard = await quotedPosts[0].evaluateHandle(el => el.closest('.post-card'));
    if (parentCard) {
      await parentCard.click();
      await page.waitForSelector('.thread-container', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'test-screenshots/thread-ui-7-quoted.png',
        fullPage: false
      });
      console.log('7. Captured thread with quoted posts');
    }
  }

  // Close browser after a delay
  setTimeout(async () => {
    await browser.close();
    console.log('Thread UI capture completed');
  }, 3000);
}

captureComplexThreads().catch(console.error);