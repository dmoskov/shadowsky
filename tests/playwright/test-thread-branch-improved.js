import { chromium } from 'playwright';

async function testImprovedThreadBranch() {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1400, height: 900 }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    await page.goto('http://127.0.0.1:5173/');
    console.log('Navigated to login page');

    // Fill in login form
    await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    console.log('Submitted login form');

    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    console.log('Feed loaded successfully');
    
    // Wait for posts
    await page.waitForTimeout(2000);
    
    // Find a post with replies and click it
    const posts = await page.$$('.post-card');
    let clicked = false;
    
    for (let i = 0; i < Math.min(posts.length, 10); i++) {
      const post = posts[i];
      const replyButton = await post.$('.engagement-btn:first-child');
      
      if (replyButton) {
        const replyText = await replyButton.textContent();
        const replyCount = parseInt(replyText.match(/\d+/)?.[0] || '0');
        
        if (replyCount > 0) {
          await post.click();
          console.log(`Clicked post with ${replyCount} replies`);
          clicked = true;
          break;
        }
      }
    }
    
    if (!clicked) {
      console.log('No posts with replies found, clicking first post');
      await posts[0].click();
    }
    
    // Wait for thread to load
    await page.waitForSelector('.thread-container', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check improvements
    console.log('\nChecking improvements:');
    
    // 1. Compose button position
    const composeFab = await page.$('.compose-fab');
    if (composeFab) {
      const box = await composeFab.boundingBox();
      console.log(`✅ Compose button moved to left: ${box.x < 100 ? 'YES' : 'NO'}`);
    }
    
    // 2. Thread branch diagram
    const branchDiagram = await page.$('.thread-branch-diagram');
    if (branchDiagram) {
      console.log('✅ Thread branch diagram found');
      
      // Check for improved elements
      const svgNodes = await page.$$('.diagram-container svg rect[rx="8"]');
      console.log(`  - Branch nodes: ${svgNodes.length}`);
      
      const expandButtons = await page.$$('.diagram-container svg rect[rx="10"]');
      console.log(`  - Expand buttons: ${expandButtons.length}`);
      
      // Check text readability
      const texts = await page.$$('.diagram-container svg text');
      if (texts.length > 0) {
        const firstText = texts[0];
        const fontSize = await firstText.evaluate(el => el.getAttribute('fontSize'));
        console.log(`  - Text font size: ${fontSize}px`);
      }
    }
    
    // Take screenshots
    await page.screenshot({ 
      path: 'test-screenshots/thread-branch-improved.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: thread-branch-improved.png');
    
    // Try to expand a branch if possible
    const expandButtons = await page.$$('.diagram-container svg rect[rx="10"]');
    if (expandButtons.length > 0) {
      console.log('\nTesting branch expansion...');
      await expandButtons[0].click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'test-screenshots/thread-branch-expanded.png',
        fullPage: false
      });
      console.log('Screenshot saved: thread-branch-expanded.png');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
      console.log('\nImproved thread branch test completed');
    }, 3000);
  }
}

testImprovedThreadBranch().catch(console.error);