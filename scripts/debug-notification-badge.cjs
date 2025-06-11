const { chromium } = require('playwright');
const fs = require('fs');

const { getTestCredentials } = require('../src/lib/test-credentials.js');
async function debugNotificationBadge() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Check if we need to login
    const needsLogin = await page.locator('.login-form').isVisible().catch(() => false);
    
    if (needsLogin) {
      console.log('2. Logging in...');
const credentials = getTestCredentials();

      await page.fill('input[placeholder*="Username"]', credentials.identifier);
      await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForSelector('.header', { timeout: 10000 });
      console.log('   ✅ Logged in successfully');
    }
    
    console.log('3. Finding notification icon...');
    const notificationButton = await page.locator('.nav-icon-button[title="Notifications"]');
    const hasNotification = await notificationButton.isVisible();
    console.log(`   Notification button visible: ${hasNotification}`);
    
    if (hasNotification) {
      // Get the badge element
      const badge = await page.locator('.notification-badge');
      const hasBadge = await badge.isVisible().catch(() => false);
      console.log(`   Badge visible: ${hasBadge}`);
      
      if (hasBadge) {
        // Get computed styles
        const styles = await badge.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            width: computed.width,
            height: computed.height,
            borderRadius: computed.borderRadius,
            border: computed.border,
            position: computed.position,
            top: computed.top,
            right: computed.right,
            fontSize: computed.fontSize,
            display: computed.display,
            padding: computed.padding,
            minWidth: computed.minWidth
          };
        });
        
        console.log('\n4. Badge computed styles:');
        Object.entries(styles).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
        
        // Check CSS variables
        const cssVars = await page.evaluate(() => {
          const root = document.documentElement;
          const computedStyle = getComputedStyle(root);
          return {
            colorError: computedStyle.getPropertyValue('--color-error'),
            colorBgPrimary: computedStyle.getPropertyValue('--color-bg-primary'),
            radiusFull: computedStyle.getPropertyValue('--radius-full')
          };
        });
        
        console.log('\n5. CSS Variables:');
        Object.entries(cssVars).forEach(([key, value]) => {
          console.log(`   --${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`);
        });
      }
      
      // Take screenshots
      console.log('\n6. Taking screenshots...');
      
      // Full header screenshot
      await page.locator('.header').screenshot({ 
        path: 'test-screenshots/notification-badge-header.png' 
      });
      
      // Close-up of notification area
      await notificationButton.screenshot({ 
        path: 'test-screenshots/notification-badge-closeup.png' 
      });
      
      console.log('   ✅ Screenshots saved');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\nKeeping browser open for inspection. Press Ctrl+C to close.');
  await new Promise(() => {});
}

debugNotificationBadge();