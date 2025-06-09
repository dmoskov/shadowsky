import playwright from 'playwright';

const browser = await playwright.chromium.launch({ 
  headless: false,
  devtools: true 
});
const page = await browser.newPage();

// Log all console messages
page.on('console', msg => {
  console.log(`Console [${msg.type()}]: ${msg.text()}`);
  if (msg.type() === 'error') {
    msg.args().forEach(async (arg) => {
      const value = await arg.jsonValue().catch(() => 'Complex object');
      console.log('  Error details:', value);
    });
  }
});

// Log page errors
page.on('pageerror', error => {
  console.error('Page error:', error.message);
  console.error('Stack:', error.stack);
});

console.log('Navigating to http://127.0.0.1:5173...');
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

// Wait a moment for any errors to appear
await page.waitForTimeout(3000);

// Check if React loaded
const reactStatus = await page.evaluate(() => {
  return {
    hasReact: typeof window.React !== 'undefined',
    hasReactDOM: typeof window.ReactDOM !== 'undefined',
    rootElement: document.getElementById('root')?.innerHTML || 'No root element',
    errors: window._errors || []
  };
});

console.log('\nReact Status:', reactStatus);

// Check network errors
console.log('\nChecking for failed network requests...');

await page.screenshot({ path: 'test-screenshots/app-error-state.png' });
console.log('Screenshot saved to test-screenshots/app-error-state.png');

console.log('\nKeeping browser open for debugging...');