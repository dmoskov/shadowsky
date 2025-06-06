import { chromium } from 'playwright';

async function testBrowser() {
  console.log('Testing browser access to dev server...');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Log all console messages
  page.on('console', msg => {
    console.log(`Browser console [${msg.type()}]:`, msg.text());
  });
  
  // Log network failures
  page.on('requestfailed', request => {
    console.log('Request failed:', request.url(), request.failure());
  });
  
  try {
    console.log('Navigating to http://127.0.0.1:5173...');
    const response = await page.goto('http://127.0.0.1:5173', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    console.log('Response status:', response?.status());
    
    // Wait a bit for React to mount
    await page.waitForTimeout(2000);
    
    // Check if React app mounted
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        exists: !!root,
        hasContent: root ? root.children.length > 0 : false,
        innerHTML: root ? root.innerHTML.substring(0, 100) : null
      };
    });
    
    console.log('Root element:', rootContent);
    
    // Check for any error messages
    const errorMessages = await page.$$eval('.error-message, .error-state', elements => 
      elements.map(el => el.textContent)
    );
    
    if (errorMessages.length > 0) {
      console.log('Error messages found:', errorMessages);
    }
    
    // Check if login form is present
    const hasLoginForm = await page.$('input[type="text"]') !== null;
    const hasFeed = await page.$('.feed-posts') !== null;
    
    console.log('Has login form:', hasLoginForm);
    console.log('Has feed:', hasFeed);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/browser-test.png',
      fullPage: true 
    });
    console.log('Screenshot saved to test-screenshots/browser-test.png');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for manual inspection...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testBrowser().catch(console.error);