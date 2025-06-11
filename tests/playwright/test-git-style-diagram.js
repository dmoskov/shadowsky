import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function testGitStyleDiagram() {
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
const credentials = getTestCredentials();

    await page.fill('input[placeholder="Username or email"]', credentials.identifier);
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
    
    // Check for new git-style diagram
    const gitDiagram = await page.$('.thread-branch-diagram-v2');
    if (gitDiagram) {
      console.log('\n✅ Git-style branch diagram found!');
      
      // Check diagram elements
      const svgElement = await page.$('.diagram-scroll-container svg');
      if (svgElement) {
        const svgBox = await svgElement.boundingBox();
        console.log(`  - SVG dimensions: ${Math.round(svgBox.width)}x${Math.round(svgBox.height)}px`);
      }
      
      // Count branches
      const circles = await page.$$('.diagram-scroll-container svg circle');
      console.log(`  - Branch nodes (circles): ${circles.length}`);
      
      // Count connections
      const paths = await page.$$('.diagram-scroll-container svg path');
      console.log(`  - Branch connections: ${paths.length}`);
      
      // Check scroll container
      const scrollContainer = await page.$('.diagram-scroll-container');
      if (scrollContainer) {
        const containerBox = await scrollContainer.boundingBox();
        console.log(`  - Container height: ${Math.round(containerBox.height)}px`);
      }
    } else {
      console.log('\n❌ Git-style diagram not found, checking for old diagram...');
      const oldDiagram = await page.$('.thread-branch-diagram');
      if (oldDiagram) {
        console.log('Found old diagram style');
      }
    }
    
    // Take screenshots
    await page.screenshot({ 
      path: 'test-screenshots/git-style-diagram.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: git-style-diagram.png');
    
    // Try hovering over a node
    const firstCircle = await page.$('.diagram-scroll-container svg circle');
    if (firstCircle) {
      await firstCircle.hover();
      await page.waitForTimeout(500);
      
      const tooltip = await page.$('.branch-tooltip-v2');
      if (tooltip) {
        console.log('\n✅ Tooltip appears on hover');
      }
      
      await page.screenshot({ 
        path: 'test-screenshots/git-style-diagram-hover.png',
        fullPage: false
      });
      console.log('Screenshot saved: git-style-diagram-hover.png');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
      console.log('\nGit-style diagram test completed');
    }, 3000);
  }
}

testGitStyleDiagram().catch(console.error);