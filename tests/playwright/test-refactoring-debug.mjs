import { chromium } from 'playwright';

async function debugTest() {
  const browser = await chromium.launch({ 
    headless: false,  // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Log all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  // Log all errors
  page.on('pageerror', error => {
    console.error('Page error:', error);
  });
  
  // Log all failed requests
  page.on('requestfailed', request => {
    console.error('Request failed:', request.url(), request.failure());
  });
  
  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    console.log('Page loaded. Waiting 5 seconds to see what happens...');
    await page.waitForTimeout(5000);
    
    // Check page content
    const content = await page.content();
    console.log('Page has content:', content.length > 100 ? 'Yes' : 'No');
    
    // Check for specific elements
    const hasRoot = await page.locator('#root').count();
    console.log('Has #root element:', hasRoot > 0 ? 'Yes' : 'No');
    
    const loginVisible = await page.locator('.login-container').isVisible().catch(() => false);
    console.log('Login container visible:', loginVisible);
    
    const errorBoundary = await page.locator('.error-boundary-message').isVisible().catch(() => false);
    console.log('Error boundary visible:', errorBoundary);
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('\nKeeping browser open for inspection. Press Ctrl+C to close.');
  await new Promise(() => {}); // Keep browser open
}

debugTest();