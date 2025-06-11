import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function testHeaderFix() {
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
const credentials = getTestCredentials();

    await page.fill('input[placeholder="Username or email"]', credentials.identifier);
    await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    console.log('Submitted login form');

    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    console.log('Feed loaded successfully');
    
    // Wait a moment for everything to render
    await page.waitForTimeout(2000);
    
    // Take before/after comparison screenshots
    const header = await page.$('.header');
    if (header) {
      await header.screenshot({ 
        path: 'test-screenshots/header-fixed-focused.png' 
      });
      console.log('Fixed header screenshot saved');
    }
    
    // Test hover state
    const userMenu = await page.$('.user-menu-trigger');
    if (userMenu) {
      await userMenu.hover();
      await page.waitForTimeout(500);
      await header.screenshot({ 
        path: 'test-screenshots/header-fixed-hover.png'
      });
      console.log('Fixed header hover screenshot saved');
      
      // Click to open dropdown
      await userMenu.click();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: 'test-screenshots/header-fixed-dropdown.png',
        fullPage: false
      });
      console.log('Fixed header with dropdown screenshot saved');
    }
    
    console.log('\nAlignment fix test completed successfully!');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
    }, 3000);
  }
}

testHeaderFix().catch(console.error);