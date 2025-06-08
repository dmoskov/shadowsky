import { chromium } from 'playwright';

async function quickThreadTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then(c => c.newPage());
  
  try {
    console.log('🔍 Checking current page...');
    
    // Just go to whatever page is currently open
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check what's visible
    const isThread = await page.locator('.thread-container').isVisible().catch(() => false);
    const isFeed = await page.locator('.feed-container').isVisible().catch(() => false);
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    
    console.log('\nPage status:');
    console.log('- Thread view:', isThread);
    console.log('- Feed view:', isFeed);
    console.log('- Login page:', isLogin);
    
    // Take a screenshot of current state
    await page.screenshot({ 
      path: 'test-screenshots/thread-current-state.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved: thread-current-state.png');
    
    if (isThread) {
      console.log('\n✅ Already on thread view!');
      
      // Check thread elements
      const elements = {
        'Main post': await page.locator('.thread-main-post').count(),
        'Ancestors': await page.locator('.thread-ancestor').count(),
        'Replies': await page.locator('.thread-reply').count(),
        'Nested posts': await page.locator('.thread-post-nested').count(),
        'Depth classes': await page.locator('[class*="depth-"]').count(),
        'OP badges': await page.locator('.is-op').count(),
      };
      
      console.log('\nThread elements found:');
      for (const [name, count] of Object.entries(elements)) {
        console.log(`- ${name}: ${count}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

quickThreadTest().catch(console.error);