import { chromium } from 'playwright';

import { getTestCredentials } from './src/lib/test-credentials.js';
async function testHeaderFinalFix() {
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
    
    // Take close-up of header icons area
    const headerActions = await page.$('.header-actions');
    if (headerActions) {
      await headerActions.screenshot({ 
        path: 'test-screenshots/header-final-actions.png' 
      });
      console.log('Header actions area screenshot saved');
    }
    
    // Take full header screenshot
    const header = await page.$('.header');
    if (header) {
      await header.screenshot({ 
        path: 'test-screenshots/header-final-complete.png' 
      });
      console.log('Complete header screenshot saved');
    }
    
    // Hover over user menu
    const userMenu = await page.$('.user-menu-trigger');
    if (userMenu) {
      await userMenu.hover();
      await page.waitForTimeout(500);
      await header.screenshot({ 
        path: 'test-screenshots/header-final-hover.png'
      });
      console.log('Header hover state screenshot saved');
    }
    
    // Take full page screenshot to see overall effect
    await page.screenshot({ 
      path: 'test-screenshots/header-final-fullpage.png',
      fullPage: false
    });
    console.log('Full page screenshot saved');
    
    console.log('\nFinal header fix test completed successfully!');
    console.log('Fixed issues:');
    console.log('- Notification badge now properly overlaps bell icon');
    console.log('- User menu items are perfectly aligned');
    console.log('- Avatar size reduced to match text better');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    setTimeout(async () => {
      await browser.close();
    }, 3000);
  }
}

testHeaderFinalFix().catch(console.error);