import { chromium } from 'playwright';

async function testHeaderAlignment() {
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1440, height: 900 }
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    await page.goto('http://127.0.0.1:5173/');
    console.log('Navigated to login page');

    // Fill in login form
    await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    console.log('Submitted login form');

    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    console.log('Feed loaded successfully');
    
    // Wait a moment for everything to render
    await page.waitForTimeout(2000);
    
    // Take screenshot of full header
    await page.screenshot({ 
      path: 'test-screenshots/header-alignment-full.png',
      fullPage: false
    });
    console.log('Full header screenshot saved');
    
    // Take focused screenshot of just the header
    const header = await page.$('.header');
    if (header) {
      await header.screenshot({ 
        path: 'test-screenshots/header-alignment-focused.png' 
      });
      console.log('Focused header screenshot saved');
    }
    
    // Hover over user menu to see dropdown trigger
    const userMenu = await page.$('.user-menu-trigger');
    if (userMenu) {
      await userMenu.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'test-screenshots/header-alignment-hover.png',
        fullPage: false
      });
      console.log('Header with hover screenshot saved');
      
      // Click to open dropdown
      await userMenu.click();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: 'test-screenshots/header-alignment-dropdown.png',
        fullPage: false
      });
      console.log('Header with dropdown screenshot saved');
    }
    
    // Test at different screen widths
    const widths = [1920, 1440, 1280, 1024];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: `test-screenshots/header-alignment-${width}w.png`,
        fullPage: false
      });
      console.log(`Screenshot at ${width}px width saved`);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
      console.log('\nHeader alignment test completed');
    }, 3000);
  }
}

testHeaderAlignment().catch(console.error);