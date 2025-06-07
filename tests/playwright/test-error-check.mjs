import { chromium } from 'playwright';

async function checkForErrors() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text() });
    console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  // Capture errors
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error);
  });
  
  try {
    console.log('Loading http://localhost:5173...\n');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);
    
    // Check page state
    const title = await page.title();
    console.log('\nPage title:', title);
    
    const rootContent = await page.locator('#root').innerHTML().catch(() => 'No #root');
    console.log('Root element:', rootContent.substring(0, 100) + '...');
    
    // Check for error boundary
    const errorBoundary = await page.locator('.error-boundary-message').textContent().catch(() => null);
    if (errorBoundary) {
      console.error('\n❌ ERROR BOUNDARY TRIGGERED:', errorBoundary);
    }
    
    // Summary
    const errors = logs.filter(l => l.type === 'error');
    console.log(`\nTotal logs: ${logs.length}`);
    console.log(`Errors: ${errors.length}`);
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('\nKeeping browser open. Press Ctrl+C to close.');
  await new Promise(() => {});
}

checkForErrors();