import { chromium } from 'playwright';

async function testThreadBranchDiagram() {
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
  await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
  await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button[type="submit"]');
  console.log('Submitted login form');

  // Wait for feed to load
  await page.waitForSelector('.feed-container', { timeout: 10000 });
  console.log('Feed loaded successfully');

  // Wait for posts to stabilize
  await page.waitForTimeout(2000);

  // Find a post with many replies to test the branch diagram
  const posts = await page.$$('.post-card');
  let threadFound = false;
  let maxReplies = 0;
  let bestPost = null;
  
  for (let i = 0; i < Math.min(posts.length, 15); i++) {
    const post = posts[i];
    
    // Check if post has replies
    const replyButton = await post.$('.engagement-btn:first-child');
    if (replyButton) {
      const replyText = await replyButton.textContent();
      const replyCount = parseInt(replyText.match(/\d+/)?.[0] || '0');
      
      console.log(`Post ${i + 1}: ${replyCount} replies`);
      
      if (replyCount > maxReplies) {
        maxReplies = replyCount;
        bestPost = post;
        if (replyCount > 5) {
          threadFound = true;
        }
      }
    }
  }
  
  if (bestPost) {
    // Click the post with the most replies
    await bestPost.click();
    console.log(`Clicked post with ${maxReplies} replies`);
  } else {
    // Just click the first post as fallback
    console.log('No posts with replies found, clicking first post');
    await posts[0].click();
  }
  
  // Wait for thread to load
  await page.waitForSelector('.thread-container', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Thread view loaded');
  
  // Check if thread navigation is present
  const threadNav = await page.$('.thread-navigation');
  if (threadNav) {
    console.log('✅ Thread navigation component found');
    
    // Check for branch diagram
    const branchDiagram = await page.$('.thread-branch-diagram');
    if (branchDiagram) {
      console.log('✅ Thread branch diagram found');
      
      // Check diagram components
      const diagramHeader = await page.$('.diagram-header h4');
      if (diagramHeader) {
        const headerText = await diagramHeader.textContent();
        console.log(`Diagram header: "${headerText}"`);
      }
      
      // Check legend
      const legendItems = await page.$$('.legend-item');
      console.log(`Found ${legendItems.length} legend items`);
      
      // Check SVG diagram
      const svgDiagram = await page.$('.diagram-container svg');
      if (svgDiagram) {
        console.log('✅ SVG branch diagram rendered');
        
        // Check for branch rectangles
        const branches = await page.$$('.diagram-container svg rect[rx="8"]');
        console.log(`Found ${branches.length} branch elements`);
        
        if (branches.length > 0) {
          // Test clicking on first branch
          console.log('\nTesting branch navigation...');
          const firstBranch = branches[0];
          
          // Get current scroll position
          const beforeClick = await page.evaluate(() => window.scrollY);
          
          // Click the branch
          await firstBranch.click();
          await page.waitForTimeout(500);
          
          const afterClick = await page.evaluate(() => window.scrollY);
          console.log(`Clicked branch: scroll changed from ${beforeClick} to ${afterClick}`);
        }
      }
      
      // Check stats
      const stats = await page.$$('.diagram-stats .stat');
      console.log(`Found ${stats.length} stat items`);
      for (let i = 0; i < stats.length; i++) {
        const statText = await stats[i].textContent();
        console.log(`  - Stat ${i + 1}: ${statText}`);
      }
      
    } else {
      console.log('❌ Thread branch diagram NOT found');
    }
    
    // Take screenshot of thread with branch diagram
    await page.screenshot({ 
      path: 'test-screenshots/thread-branch-diagram.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: thread-branch-diagram.png');
    
  } else {
    console.log('❌ Thread navigation component NOT found');
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'test-screenshots/thread-branch-diagram-missing.png',
      fullPage: false
    });
  }

  // Close browser after a delay
  setTimeout(async () => {
    await browser.close();
    console.log('\nThread branch diagram test completed');
  }, 3000);
}

testThreadBranchDiagram().catch(console.error);