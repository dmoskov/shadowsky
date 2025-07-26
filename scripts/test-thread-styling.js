#!/usr/bin/env node

/**
 * Test script to verify thread styling changes
 */

const { chromium } = require('playwright');
const path = require('path');

async function testThreadStyling() {
  console.log('Testing thread styling changes...');
  
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Login if needed
    const loginButton = await page.$('button:has-text("Sign in")');
    if (loginButton) {
      console.log('Logging in...');
      await page.fill('input[placeholder*="alice"]', 'test-account.bsky.social');
      await page.fill('input[type="password"]', process.env.BSKY_PASSWORD || 'your-password');
      await loginButton.click();
      await page.waitForSelector('.post-card', { timeout: 10000 });
    }
    
    // Check feed for reply indicators
    console.log('Checking feed view for reply indicators...');
    const replyIndicators = await page.$$('.flex.items-center.gap-1\\.5.px-4.pt-2.text-gray-500.text-sm');
    console.log(`Found ${replyIndicators.length} reply indicators in feed`);
    
    // Find a post with replies and click it
    console.log('Looking for a post to view thread...');
    const postsWithReplies = await page.$$('button:has-text("Reply")');
    
    if (postsWithReplies.length > 0) {
      // Click on a post to view thread
      const postCard = await postsWithReplies[0].$('ancestor::article');
      if (postCard) {
        await postCard.click();
        await page.waitForTimeout(1000);
        
        // Check thread view styling
        console.log('Checking thread view styling...');
        
        // Check for main post with blue border
        const mainPost = await page.$('.border-l-4.border-blue-500');
        console.log('Main post with blue border:', !!mainPost);
        
        // Check for parent posts with smaller text
        const parentPosts = await page.$$('.text-sm');
        console.log(`Parent posts with smaller text: ${parentPosts.length}`);
        
        // Check for thread lines
        const threadLines = await page.$$('.absolute.left-6.top-14.bottom-0.w-0\\.5.bg-gray-700');
        console.log(`Thread lines found: ${threadLines.length}`);
        
        // Check reply section separator
        const replySeparator = await page.$('.border-t.border-gray-800.mt-4');
        console.log('Reply section separator:', !!replySeparator);
        
        // Take screenshot
        await page.screenshot({ 
          path: path.join(__dirname, '../test-screenshots/thread-styling-test.png'),
          fullPage: true 
        });
        console.log('Screenshot saved to test-screenshots/thread-styling-test.png');
      }
    }
    
    console.log('\nTest complete!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testThreadStyling().catch(console.error);