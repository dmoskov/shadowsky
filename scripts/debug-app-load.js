import puppeteer from 'puppeteer';

console.log('Starting app debug...');

const browser = await puppeteer.launch({
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

// Capture console logs
page.on('console', msg => {
  const type = msg.type();
  const text = msg.text();
  console.log(`Browser console [${type}]:`, text);
});

// Capture page errors
page.on('pageerror', error => {
  console.error('Page error:', error.message);
});

// Capture request failures
page.on('requestfailed', request => {
  console.error('Request failed:', request.url(), request.failure().errorText);
});

console.log('Navigating to http://127.0.0.1:5173...');
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });

// Wait a bit for React to render
await page.waitForTimeout(2000);

// Check page content
const rootContent = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    exists: !!root,
    hasContent: root ? root.children.length > 0 : false,
    innerHTML: root ? root.innerHTML.substring(0, 200) : null,
    bodyHTML: document.body.innerHTML.substring(0, 500)
  };
});

console.log('\nRoot element status:', rootContent);

// Check for React errors
const reactErrors = await page.evaluate(() => {
  return window._REACT_ERROR_ || null;
});

if (reactErrors) {
  console.error('\nReact errors found:', reactErrors);
}

// Take screenshot
await page.screenshot({ path: 'test-screenshots/debug-app-load.png', fullPage: true });
console.log('\nScreenshot saved to test-screenshots/debug-app-load.png');

console.log('\nBrowser will stay open for manual inspection...');
// Keep browser open for debugging