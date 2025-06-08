import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then(ctx => ctx.newPage());
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('Like') || msg.text().includes('Updating')) {
      console.log(`[${msg.type()}]`, msg.text());
    }
  });
  
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(2000);
  
  // Login if needed
  if (await page.locator('button:has-text("Login")').count() > 0) {
    console.log('Logging in...');
    await page.fill('input[type="text"], input[type="email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button:has-text("Login")');
    await page.waitForTimeout(5000);
  }
  
  // Find a liked post (has active class)
  let likeBtn = page.locator('.like-btn.active').first();
  const hasLikedPost = await likeBtn.count() > 0;
  
  if (!hasLikedPost) {
    console.log('No liked posts found, using first button');
    likeBtn = page.locator('.like-btn').first();
  } else {
    console.log('Found a liked post to unlike');
  }
  await likeBtn.waitFor({ timeout: 5000 });
  
  const initialText = await likeBtn.textContent();
  console.log('Initial:', initialText);
  
  await likeBtn.click();
  
  // Wait and check multiple times
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const text = await likeBtn.textContent();
    console.log(`After ${i+1}s:`, text);
    if (text !== initialText) {
      console.log('SUCCESS! Button updated');
      break;
    }
  }
  
  await page.waitForTimeout(30000);
  await browser.close();
})();