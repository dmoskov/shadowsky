import { chromium } from '@playwright/test';

async function captureBaseline() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const baselineDir = 'tests/visual-compare-tailwind';
  
  console.log('1. Capturing login page...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${baselineDir}/01-login-page.png`, fullPage: true });

  console.log('2. Logging in...');
  await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
  await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
  await page.click('button[type="submit"]');
  
  // Wait for feed to load
  try {
    await page.waitForSelector('.feed-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Feed container not found, continuing...');
  }

  console.log('3. Capturing feed view...');
  await page.screenshot({ path: `${baselineDir}/02-feed-view.png`, fullPage: true });

  console.log('4. Capturing header...');
  const header = await page.$('.header-container');
  if (header) {
    await header.screenshot({ path: `${baselineDir}/03-header.png` });
  }

  console.log('5. Capturing sidebar...');
  const sidebar = await page.$('.sidebar-container');
  if (sidebar) {
    await sidebar.screenshot({ path: `${baselineDir}/04-sidebar.png` });
  }

  console.log('6. Capturing first post...');
  const post = await page.$('.post-card');
  if (post) {
    await post.screenshot({ path: `${baselineDir}/05-post-card.png` });
  }

  console.log('7. Capturing mobile view...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${baselineDir}/06-mobile-view.png`, fullPage: true });

  console.log('8. Capturing tablet view...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${baselineDir}/07-tablet-view.png`, fullPage: true });

  await browser.close();
  console.log('\n✅ Baseline captured successfully!');
}

captureBaseline().catch(err => {
  console.error('❌ Error capturing baseline:', err);
  process.exit(1);
});