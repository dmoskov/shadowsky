import { chromium } from '@playwright/test';
import fs from 'fs/promises';

async function captureProgressScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log('1. Capturing login page with Tailwind...');
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(2000);
  
  await page.screenshot({ 
    path: 'tests/screenshots/tailwind-progress-login.png',
    fullPage: true 
  });
  
  // Try to log in
  console.log('2. Attempting to log in...');
  
  // Read test credentials
  try {
    const creds = JSON.parse(await fs.readFile('.test-credentials', 'utf-8'));
    
    await page.fill('input[type="text"]', creds.identifier);
    await page.fill('input[type="password"]', creds.password);
    
    await page.screenshot({ 
      path: 'tests/screenshots/tailwind-progress-login-filled.png',
      fullPage: true 
    });
    
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    console.log('3. Capturing main app with migrated components...');
    await page.screenshot({ 
      path: 'tests/screenshots/tailwind-progress-main.png',
      fullPage: true 
    });
    
    console.log('Screenshots saved to tests/screenshots/');
  } catch (error) {
    console.log('Could not read credentials, showing login only');
  }
  
  console.log('Keeping browser open for manual inspection...');
}

captureProgressScreenshots().catch(console.error);