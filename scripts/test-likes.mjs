import { chromium } from 'playwright';

async function testLikeFunctionality() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`Console ${type}:`, msg.text());
    }
  });
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    
    // Check if already logged in by looking for feed
    const feedExists = await page.$('.feed-posts');
    
    if (!feedExists) {
      // Need to login
      console.log('Logging in...');
      await page.fill('input[type="text"]', 'bskyclienttest.bsky.social');
      await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.feed-posts', { timeout: 10000 });
    }
    
    // Wait for posts to load
    console.log('Waiting for posts...');
    await page.waitForTimeout(3000);
    
    // Find like buttons
    const likeButtons = await page.$$('.like-btn');
    console.log(`Found ${likeButtons.length} like buttons`);
    
    if (likeButtons.length > 0) {
      // Get initial state of first post
      const firstLikeBtn = likeButtons[0];
      const initialState = await firstLikeBtn.evaluate(btn => {
        const isActive = btn.classList.contains('active');
        const count = btn.querySelector('span')?.textContent || '0';
        return { isActive, count };
      });
      
      console.log('Initial like state:', initialState);
      
      // Click to toggle like
      console.log('Clicking like button...');
      await firstLikeBtn.click();
      
      // Wait for the action to complete
      await page.waitForTimeout(2000);
      
      // Check new state
      const newState = await firstLikeBtn.evaluate(btn => {
        const isActive = btn.classList.contains('active');
        const count = btn.querySelector('span')?.textContent || '0';
        return { isActive, count };
      });
      
      console.log('New like state:', newState);
      
      // Verify the change
      if (initialState.isActive !== newState.isActive) {
        console.log('✅ Like toggle successful!');
        const expectedCount = initialState.isActive 
          ? parseInt(initialState.count) - 1 
          : parseInt(initialState.count) + 1;
        if (parseInt(newState.count) === expectedCount) {
          console.log('✅ Like count updated correctly!');
        } else {
          console.log('⚠️ Like count mismatch. Expected:', expectedCount, 'Got:', newState.count);
        }
      } else {
        console.log('❌ Like state did not change');
      }
      
      // Test repost functionality
      console.log('\\nTesting repost functionality...');
      const repostButtons = await page.$$('.engagement-btn:has(svg[class*="lucide-repeat2"])');
      if (repostButtons.length > 0) {
        const firstRepostBtn = repostButtons[0];
        const initialRepostState = await firstRepostBtn.evaluate(btn => {
          const isActive = btn.classList.contains('active');
          const count = btn.querySelector('span')?.textContent || '0';
          return { isActive, count };
        });
        
        console.log('Initial repost state:', initialRepostState);
        
        await firstRepostBtn.click();
        await page.waitForTimeout(2000);
        
        const newRepostState = await firstRepostBtn.evaluate(btn => {
          const isActive = btn.classList.contains('active');
          const count = btn.querySelector('span')?.textContent || '0';
          return { isActive, count };
        });
        
        console.log('New repost state:', newRepostState);
        
        if (initialRepostState.isActive !== newRepostState.isActive) {
          console.log('✅ Repost toggle successful!');
        }
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/likes-test.png',
      fullPage: true 
    });
    console.log('\\nScreenshot saved to test-screenshots/likes-test.png');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ 
      path: 'test-screenshots/likes-error.png',
      fullPage: true 
    });
  }
  
  // Keep browser open for observation
  await page.waitForTimeout(5000);
  await browser.close();
}

testLikeFunctionality().catch(console.error);