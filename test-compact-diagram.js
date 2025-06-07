import { chromium } from 'playwright';

async function testCompactDiagram() {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1440, height: 800 }
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
    
    // Wait for posts and find one with many replies
    await page.waitForTimeout(2000);
    
    // Scroll to find posts with more replies
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }
    
    const posts = await page.$$('.post-card');
    let bestPost = null;
    let maxReplies = 0;
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const replyButton = await post.$('.engagement-btn:first-child');
      
      if (replyButton) {
        const replyText = await replyButton.textContent();
        const replyCount = parseInt(replyText.match(/\d+/)?.[0] || '0');
        
        if (replyCount > maxReplies) {
          maxReplies = replyCount;
          bestPost = post;
        }
      }
    }
    
    if (bestPost && maxReplies > 0) {
      console.log(`Found post with ${maxReplies} replies`);
      await bestPost.click();
    } else {
      console.log('No posts with replies found, clicking first post');
      await posts[0].click();
    }
    
    // Wait for thread to load
    await page.waitForSelector('.thread-container', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check for compact diagram
    const compactDiagram = await page.$('.thread-branch-diagram-compact');
    if (compactDiagram) {
      console.log('\n✅ Compact branch diagram found!');
      
      // Check diagram stats
      const statsText = await page.$('.diagram-stats-compact');
      if (statsText) {
        const stats = await statsText.textContent();
        console.log(`  - Stats: ${stats}`);
      }
      
      // Count nodes
      const nodes = await page.$$('.diagram-scroll-container-compact svg circle');
      console.log(`  - Branch nodes: ${nodes.length}`);
      
      // Check container size
      const containerBox = await compactDiagram.boundingBox();
      console.log(`  - Diagram height: ${Math.round(containerBox.height)}px`);
      
      // Check navigation panel size
      const navPanel = await page.$('.thread-navigation');
      if (navPanel) {
        const navBox = await navPanel.boundingBox();
        console.log(`  - Navigation panel height: ${Math.round(navBox.height)}px`);
        console.log(`  - Navigation panel width: ${Math.round(navBox.width)}px`);
      }
    }
    
    // Take screenshots
    await page.screenshot({ 
      path: 'test-screenshots/compact-diagram-full.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: compact-diagram-full.png');
    
    // Test hover
    const firstNode = await page.$('.diagram-scroll-container-compact svg g');
    if (firstNode) {
      await firstNode.hover();
      await page.waitForTimeout(500);
      
      const tooltip = await page.$('.branch-tooltip-compact');
      if (tooltip) {
        console.log('\n✅ Compact tooltip appears on hover');
      }
      
      await page.screenshot({ 
        path: 'test-screenshots/compact-diagram-hover.png',
        fullPage: false
      });
      console.log('Screenshot saved: compact-diagram-hover.png');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
      console.log('\nCompact diagram test completed');
    }, 3000);
  }
}

testCompactDiagram().catch(console.error);