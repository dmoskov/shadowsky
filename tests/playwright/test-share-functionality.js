import { chromium } from 'playwright';

import { getTestCredentials } from '../../src/lib/test-credentials.js';
async function testShareFunctionality() {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

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

  // Wait for posts to load
  await page.waitForTimeout(2000);
  
  // Test share button
  const shareButtons = await page.$$('.engagement-btn:has(svg[stroke="currentColor"])');
  console.log(`Found ${shareButtons.length} engagement buttons`);
  
  // Find the share button by looking for the Share icon
  const shareButton = await page.$('button.engagement-btn:has-text("Share")');
  if (!shareButton) {
    // Try finding by icon
    const allButtons = await page.$$('.engagement-btn');
    for (const btn of allButtons) {
      const svg = await btn.$('svg');
      if (svg) {
        const viewBox = await svg.getAttribute('viewBox');
        // Share icon typically has specific path data
        const isShareButton = await btn.evaluate(el => {
          const svg = el.querySelector('svg');
          return svg && !el.textContent.match(/\d+/); // No numbers = likely share button
        });
        if (isShareButton) {
          console.log('Found share button');
          await btn.click();
          await page.waitForTimeout(1000);
          break;
        }
      }
    }
  }

  // Test copy link from menu
  await page.waitForTimeout(1000);
  
  // Find the three dots menu button on the first post
  const menuButtons = await page.$$('.btn-icon.btn-ghost:has(svg)');
  console.log(`Found ${menuButtons.length} menu buttons`);
  
  if (menuButtons.length > 0) {
    // Click the first menu button found
    await menuButtons[0].click();
    console.log('Clicked menu button');
        
    // Wait for menu to appear
    await page.waitForSelector('.post-menu', { timeout: 5000 });
    
    // Click copy link
    const copyLinkButton = await page.$('button:has-text("Copy link")');
    if (copyLinkButton) {
      await copyLinkButton.click();
      console.log('Clicked copy link');
      
      // Check if it changed to "Link copied!"
      await page.waitForTimeout(500);
      const copiedText = await page.$('button:has-text("Link copied!")');
      if (copiedText) {
        console.log('✅ Copy link functionality working!');
        
        // Try to read clipboard (may not work in all environments)
        try {
          const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
          console.log('Clipboard content:', clipboardText);
        } catch (e) {
          console.log('Could not read clipboard (expected in some environments)');
        }
      } else {
        console.log('❌ Copy link may not be working');
      }
    }
  }

  // Take screenshot
  await page.screenshot({ 
    path: 'test-screenshots/share-functionality-test.png',
    fullPage: false
  });
  console.log('Screenshot captured');

  // Close browser after a delay to see results
  setTimeout(async () => {
    await browser.close();
    console.log('Test completed');
  }, 3000);
}

testShareFunctionality().catch(console.error);