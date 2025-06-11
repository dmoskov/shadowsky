import { chromium } from 'playwright';
import fs from 'fs/promises';

async function testAnalytics() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔗 Opening application...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);

    // Check if we need to log in
    const loginButton = await page.$('button:has-text("Login")');
    if (loginButton) {
      console.log('🔐 Logging in...');
      
      // Read credentials from .test-credentials
      const credentials = await fs.readFile('.test-credentials', 'utf-8');
      const lines = credentials.split('\n');
      const username = lines.find(l => l.startsWith('TEST_USER=')).split('=')[1];
      const password = lines.find(l => l.startsWith('TEST_PASS=')).split('=')[1];
      
      await page.fill('input[placeholder*="Username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Login")');
      await page.waitForTimeout(3000);
    }

    // Wait for feed to load
    console.log('⏳ Waiting for feed to load...');
    await page.waitForSelector('.post-card', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Navigate to analytics
    console.log('📊 Navigating to analytics...');
    
    // Click analytics in sidebar
    const analyticsLink = await page.$('a[href="/analytics"]');
    if (analyticsLink) {
      await analyticsLink.click();
    } else {
      // Try mobile menu
      await page.click('.mobile-menu-toggle');
      await page.waitForTimeout(500);
      await page.click('a[href="/analytics"]');
    }
    
    await page.waitForTimeout(3000);

    // Take screenshots of analytics page
    console.log('📸 Capturing analytics screenshots...');
    
    // Full page
    await page.screenshot({ 
      path: './tests/screenshots/analytics-full.png',
      fullPage: false
    });
    
    // Scroll down to see more
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/analytics-content.png',
      fullPage: false
    });
    
    // Test time range selector
    console.log('⏰ Testing time range selector...');
    await page.click('button:has-text("7 days")');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: './tests/screenshots/analytics-7days.png',
      fullPage: false
    });
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/analytics-insights.png',
      fullPage: false
    });
    
    // Test mobile view
    console.log('📱 Testing mobile view...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: './tests/screenshots/analytics-mobile.png',
      fullPage: true
    });

    console.log('✅ Analytics test completed!');
    console.log('Screenshots saved:');
    console.log('   - analytics-full.png');
    console.log('   - analytics-content.png');
    console.log('   - analytics-7days.png');
    console.log('   - analytics-insights.png');
    console.log('   - analytics-mobile.png');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ 
      path: './tests/screenshots/analytics-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testAnalytics();