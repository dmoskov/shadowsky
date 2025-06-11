import { chromium } from 'playwright';

import { getTestCredentials } from '../../src/lib/test-credentials.js';
async function testViewportFit() {
  const browser = await chromium.launch({ 
    headless: false,
    // Test at the problematic viewport size
    viewport: { width: 1440, height: 780 }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    await page.goto('http://127.0.0.1:5173/');
    console.log('Navigated to login page');

    // Fill in login form
const credentials = getTestCredentials();

    await page.fill('input[placeholder="Username or email"]', credentials.identifier);
    await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    console.log('Submitted login form');

    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    console.log('Feed loaded successfully');
    
    // Find and click a post with replies
    await page.waitForTimeout(2000);
    const posts = await page.$$('.post-card');
    
    for (let i = 0; i < Math.min(posts.length, 10); i++) {
      const post = posts[i];
      const replyButton = await post.$('.engagement-btn:first-child');
      
      if (replyButton) {
        const replyText = await replyButton.textContent();
        const replyCount = parseInt(replyText.match(/\d+/)?.[0] || '0');
        
        if (replyCount > 0) {
          await post.click();
          console.log(`Clicked post with ${replyCount} replies`);
          break;
        }
      }
    }
    
    // Wait for thread to load
    await page.waitForSelector('.thread-container', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check thread navigation positioning
    const threadNav = await page.$('.thread-navigation');
    if (threadNav) {
      const navBox = await threadNav.boundingBox();
      const viewport = page.viewportSize();
      
      console.log('\nThread Navigation positioning:');
      console.log(`  - Top: ${navBox.y}px`);
      console.log(`  - Bottom: ${navBox.y + navBox.height}px`);
      console.log(`  - Height: ${navBox.height}px`);
      console.log(`  - Viewport height: ${viewport.height}px`);
      console.log(`  - Fits in viewport: ${navBox.y + navBox.height < viewport.height ? 'YES ✅' : 'NO ❌'}`);
      
      // Check if diagram is visible
      const diagram = await page.$('.thread-branch-diagram-v2');
      if (diagram) {
        const diagramBox = await diagram.boundingBox();
        console.log('\nDiagram dimensions:');
        console.log(`  - Height: ${diagramBox.height}px`);
        
        // Check if scroll container is working
        const scrollContainer = await page.$('.diagram-scroll-container');
        if (scrollContainer) {
          const hasScroll = await scrollContainer.evaluate(el => el.scrollHeight > el.clientHeight);
          console.log(`  - Has scroll: ${hasScroll ? 'YES' : 'NO'}`);
        }
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/viewport-fit-test.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: viewport-fit-test.png');
    
    // Test at different viewport heights
    console.log('\nTesting different viewport heights:');
    const heights = [600, 700, 800, 900];
    
    for (const height of heights) {
      await page.setViewportSize({ width: 1440, height });
      await page.waitForTimeout(500);
      
      const navBox = await threadNav.boundingBox();
      const fits = navBox.y + navBox.height < height;
      console.log(`  - ${height}px: ${fits ? 'FITS ✅' : 'OVERFLOW ❌'}`);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
      console.log('\nViewport fit test completed');
    }, 3000);
  }
}

testViewportFit().catch(console.error);