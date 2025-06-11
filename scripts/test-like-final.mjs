import { chromium } from '@playwright/test';

import { getTestCredentials } from '../src/lib/test-credentials.js';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then(ctx => ctx.newPage());
  
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(2000);
  
  // Login if needed
  if (await page.locator('button:has-text("Login")').count() > 0) {
    console.log('Logging in...');
const credentials = getTestCredentials();

    await page.fill('input[type="text"], input[type="email"]', credentials.identifier);
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button:has-text("Login")');
    await page.waitForTimeout(5000);
  }
  
  console.log('Testing like functionality...\n');
  
  // Test 1: Like an unliked post
  console.log('TEST 1: Liking a post');
  let unlikedBtn = page.locator('.like-btn:not(.active)').first();
  await unlikedBtn.waitFor({ timeout: 5000 });
  
  const initialUnliked = await unlikedBtn.textContent();
  console.log('Initial count:', initialUnliked);
  
  await unlikedBtn.click();
  await page.waitForTimeout(2000);
  
  const afterLike = await unlikedBtn.textContent();
  console.log('After like:', afterLike);
  console.log('Result:', initialUnliked !== afterLike ? '✅ PASSED' : '❌ FAILED');
  
  // Test 2: Unlike a liked post
  console.log('\nTEST 2: Unliking a post');
  let likedBtn = page.locator('.like-btn.active').first();
  const hasLikedPost = await likedBtn.count() > 0;
  
  if (hasLikedPost) {
    const initialLiked = await likedBtn.textContent();
    console.log('Initial count:', initialLiked);
    
    await likedBtn.click();
    await page.waitForTimeout(2000);
    
    const afterUnlike = await likedBtn.textContent();
    console.log('After unlike:', afterUnlike);
    console.log('Result:', initialLiked !== afterUnlike ? '✅ PASSED' : '❌ FAILED');
  } else {
    console.log('No liked posts found to test unlike');
  }
  
  console.log('\nAll tests completed!');
  await page.waitForTimeout(10000);
  await browser.close();
})();