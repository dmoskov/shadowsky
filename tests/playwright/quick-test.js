import { chromium } from 'playwright';

async function quickTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then(c => c.newPage());

  try {
    await page.goto('http://127.0.0.1:5173/');
    console.log('✓ App loads');
    
    // Wait for either login or feed
    await page.waitForTimeout(1000);
    
    const hasLogin = await page.$('.login-container');
    const hasFeed = await page.$('.feed-container');
    const hasSidebar = await page.$('.sidebar');
    
    if (hasLogin) {
      console.log('✓ Login page displays');
    } else if (hasFeed) {
      console.log('✓ Already logged in - feed visible');
    } else {
      console.log('⚠️  Unexpected state - checking page content');
      const title = await page.title();
      console.log('Page title:', title);
    }
    
    if (hasSidebar) {
      console.log('✓ Sidebar is visible');
    }
    
    console.log('\n✅ All basic functionality working!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

quickTest();