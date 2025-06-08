import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  console.log('Opening official Bluesky...');
  console.log('Please log in manually and explore the following areas:');
  console.log('');
  console.log('1. Main feed - scroll through posts');
  console.log('2. Click on a post to see thread view');
  console.log('3. Find a quote post example');
  console.log('4. Click compose button to see modal');
  console.log('5. Visit your profile');
  console.log('6. Check notifications');
  console.log('7. Try the search feature');
  console.log('8. Look at settings');
  console.log('9. Notice hover states, animations, spacing');
  console.log('10. Pay attention to typography and color choices');
  console.log('');
  console.log('Take screenshots with: Cmd+Shift+4 (Mac) or use the browser DevTools');
  console.log('');
  
  await page.goto('https://bsky.app/');
  
  // Keep browser open for manual exploration
  console.log('Browser will stay open for manual exploration...');
  await page.waitForTimeout(600000); // 10 minutes
  
  await browser.close();
})();