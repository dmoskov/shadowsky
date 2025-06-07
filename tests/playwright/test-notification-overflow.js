import { chromium } from 'playwright';
import fs from 'fs';

async function testNotificationOverflow() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Load test credentials
    const creds = fs.readFileSync('.test-credentials', 'utf8');
    const username = creds.match(/TEST_USER=(.+)/)[1];
    const password = creds.match(/TEST_PASS=(.+)/)[1];
    
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Debug what's on the page
    const pageInfo = await page.evaluate(() => {
      return {
        hasLoginForm: !!document.querySelector('.login-form'),
        hasLoginButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Login')),
        hasHeader: !!document.querySelector('.header'),
        bodyText: document.body.innerText.substring(0, 100)
      };
    });
    console.log('Page state:', pageInfo);
    
    // Login if needed
    const needsLogin = pageInfo.hasLoginButton || pageInfo.hasLoginForm;
    if (needsLogin) {
      console.log('2. Logging in...');
      await page.fill('input[placeholder*="Username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      
      // Wait for navigation away from login
      await page.waitForFunction(() => {
        return !document.querySelector('.login-form');
      }, { timeout: 10000 });
      
      // Wait for header to appear
      await page.waitForSelector('.header', { timeout: 10000 });
      console.log('   ✅ Logged in successfully');
      
      // Give the page a moment to fully render
      await page.waitForTimeout(1000);
    }
    
    console.log('3. Waiting for notification button...');
    
    // Debug: list all buttons on page
    const buttons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      return Array.from(btns).map(b => ({
        className: b.className,
        text: b.textContent?.trim(),
        hasIcon: b.querySelector('svg') !== null
      }));
    });
    console.log('Found buttons:', buttons);
    
    // Test overflow issue
    const result = await page.evaluate(() => {
      // Try multiple selectors
      let btn = document.querySelector('.notification-btn');
      if (!btn) btn = document.querySelector('button[title="Notifications"]');
      if (!btn) btn = document.querySelector('.nav-icon-button[title="Notifications"]');
      if (!btn) {
        // Find by icon
        const bells = document.querySelectorAll('svg');
        for (const svg of bells) {
          if (svg.innerHTML.includes('bell') || svg.parentElement?.title?.includes('Notification')) {
            btn = svg.closest('button');
            break;
          }
        }
      }
      
      if (!btn) return { error: 'Button not found with any selector' };
      
      // Get original styles
      const originalStyles = window.getComputedStyle(btn);
      const original = {
        overflow: originalStyles.overflow,
        position: originalStyles.position
      };
      
      // Inject badge
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.textContent = '5';
      btn.appendChild(badge);
      
      // Test with overflow hidden vs visible
      btn.style.overflow = 'hidden';
      const hiddenRect = badge.getBoundingClientRect();
      const hiddenVisible = hiddenRect.width > 0;
      
      btn.style.overflow = 'visible';
      const visibleRect = badge.getBoundingClientRect();
      const visibleVisible = visibleRect.width > 0;
      
      // Reset to original
      btn.style.overflow = original.overflow;
      
      return {
        original,
        badgeVisibleWithHidden: hiddenVisible,
        badgeVisibleWithVisible: visibleVisible,
        diagnosis: !hiddenVisible && visibleVisible ? 'overflow:hidden is clipping the badge' : 'other issue'
      };
    });
    
    console.log('\n📊 Results:');
    if (result.error) {
      console.log('Error:', result.error);
    } else {
      console.log('Original button overflow:', result.original.overflow);
      console.log('Badge visible with overflow:hidden?', result.badgeVisibleWithHidden);
      console.log('Badge visible with overflow:visible?', result.badgeVisibleWithVisible);
      console.log('Diagnosis:', result.diagnosis);
    }
    
    // Take comparison screenshots only if button was found
    if (!result.error) {
      await page.evaluate(() => {
        const btn = document.querySelector('.notification-btn');
        if (btn) btn.style.overflow = 'hidden';
      });
      await page.screenshot({ path: 'test-screenshots/notification-overflow-hidden.png' });
      
      await page.evaluate(() => {
        const btn = document.querySelector('.notification-btn');
        if (btn) btn.style.overflow = 'visible';
      });
      await page.screenshot({ path: 'test-screenshots/notification-overflow-visible.png' });
      
      console.log('\n📸 Screenshots saved showing the difference');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  await browser.close();
}

testNotificationOverflow();