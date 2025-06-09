import { chromium } from '@playwright/test';
import fs from 'fs/promises';

async function testLayoutFix() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log('1. Logging in...');
  await page.goto('http://127.0.0.1:5173/');
  
  try {
    const creds = JSON.parse(await fs.readFile('.test-credentials', 'utf-8'));
    
    await page.fill('input[type="text"]', creds.identifier);
    await page.fill('input[type="password"]', creds.password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    console.log('2. Navigating to notifications...');
    await page.goto('http://127.0.0.1:5173/notifications');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/layout-fix-notifications.png',
      fullPage: true 
    });
    
    console.log('3. Testing different screen sizes...');
    
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'tests/screenshots/layout-fix-desktop.png',
      fullPage: false 
    });
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'tests/screenshots/layout-fix-tablet.png',
      fullPage: false 
    });
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'tests/screenshots/layout-fix-mobile.png',
      fullPage: false 
    });
    
    console.log('Screenshots saved to tests/screenshots/');
    console.log('Keeping browser open for inspection...');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testLayoutFix().catch(console.error);