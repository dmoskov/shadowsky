import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function testComplexThreadDiagram() {
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
  await page.waitForTimeout(2000);

  // Scroll to load more posts and find threads with higher reply counts
  console.log('Scrolling to find threads with more replies...');
  for (let scroll = 0; scroll < 3; scroll++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1500);
  }

  // Find the post with the most replies
  const posts = await page.$$('.post-card');
  let maxReplies = 0;
  let bestPost = null;
  let postDetails = [];
  
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    // Check if post has replies
    const replyButton = await post.$('.engagement-btn:first-child');
    if (replyButton) {
      const replyText = await replyButton.textContent();
      const replyCount = parseInt(replyText.match(/\d+/)?.[0] || '0');
      
      if (replyCount > 0) {
        // Get author info
        const authorEl = await post.$('.post-author-name');
        const author = await authorEl?.textContent() || 'Unknown';
        
        postDetails.push({ index: i, author, replyCount });
        
        if (replyCount > maxReplies) {
          maxReplies = replyCount;
          bestPost = post;
        }
      }
    }
  }
  
  // Log all posts with replies
  console.log('\nPosts with replies:');
  postDetails.sort((a, b) => b.replyCount - a.replyCount).slice(0, 10).forEach(p => {
    console.log(`  - ${p.author}: ${p.replyCount} replies`);
  });
  
  if (bestPost && maxReplies > 2) {
    // Click the post with the most replies
    await bestPost.click();
    console.log(`\nClicked post with ${maxReplies} replies`);
  } else {
    console.log('\nNo posts with significant replies found');
    await browser.close();
    return;
  }
  
  // Wait for thread to load
  await page.waitForSelector('.thread-container', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Thread view loaded');
  
  // Analyze thread structure
  const threadPosts = await page.$$('.thread-post-nested');
  console.log(`Thread contains ${threadPosts.length} posts`);
  
  // Check branch diagram
  const branchDiagram = await page.$('.thread-branch-diagram');
  if (branchDiagram) {
    console.log('\n✅ Thread branch diagram found');
    
    // Count SVG branches
    const branches = await page.$$('.diagram-container svg rect[rx="8"]');
    console.log(`Diagram shows ${branches.length} branches`);
    
    // Get stats
    const stats = await page.$$('.diagram-stats .stat');
    for (let i = 0; i < stats.length; i++) {
      const statText = await stats[i].textContent();
      console.log(`  ${statText}`);
    }
    
    // Take multiple screenshots at different scroll positions
    console.log('\nCapturing thread visualization...');
    
    // Screenshot 1: Top of thread with diagram visible
    await page.screenshot({ 
      path: 'test-screenshots/complex-thread-top.png',
      fullPage: false
    });
    
    // Scroll to middle
    await page.evaluate(() => {
      const posts = document.querySelectorAll('.thread-post-nested');
      if (posts.length > 3) {
        posts[Math.floor(posts.length / 2)].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await page.waitForTimeout(1000);
    
    // Screenshot 2: Middle of thread
    await page.screenshot({ 
      path: 'test-screenshots/complex-thread-middle.png',
      fullPage: false
    });
    
    // Test branch clicking
    if (branches.length > 1) {
      console.log('\nTesting branch navigation...');
      const secondBranch = branches[1];
      await secondBranch.click();
      await page.waitForTimeout(500);
      console.log('Clicked on second branch');
    }
    
    console.log('\nScreenshots saved:');
    console.log('  - complex-thread-top.png');
    console.log('  - complex-thread-middle.png');
    
  } else {
    console.log('❌ Thread branch diagram NOT found');
  }

  // Close browser after a delay
  setTimeout(async () => {
    await browser.close();
    console.log('\nComplex thread diagram test completed');
  }, 3000);
}

testComplexThreadDiagram().catch(console.error);