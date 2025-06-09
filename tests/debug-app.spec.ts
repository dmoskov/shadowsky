import { test } from '@playwright/test';

test.describe('Debug App Loading', () => {
  test('check for errors and app state', async ({ page }) => {
    // Collect console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Collect page errors
    const pageErrors: string[] = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the app
    console.log('Navigating to app...');
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    
    console.log('Response status:', response?.status());
    console.log('Response URL:', response?.url());

    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check for any content in body
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length);
    console.log('Body text preview:', bodyText?.substring(0, 200));

    // Check for specific elements
    const hasApp = await page.locator('#root, .app, [data-app]').count();
    console.log('App root elements found:', hasApp);

    // Check for React root
    const reactRoot = await page.locator('#root').count();
    console.log('React root found:', reactRoot);

    // Get HTML structure
    const html = await page.content();
    console.log('HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 500));

    // Print console messages
    if (consoleMessages.length > 0) {
      console.log('\n=== Console Messages ===');
      consoleMessages.forEach(msg => console.log(msg));
    }

    // Print errors
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(err => console.log(err));
    }

    // Check network failures
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    // Take debug screenshot
    await page.screenshot({ path: 'tests/screenshots/debug-state.png', fullPage: true });

    if (failedRequests.length > 0) {
      console.log('\n=== Failed Requests ===');
      failedRequests.forEach(req => console.log(req));
    }
  });
});