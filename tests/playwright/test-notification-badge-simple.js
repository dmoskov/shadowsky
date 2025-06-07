import { chromium } from 'playwright';

async function testNotificationBadge() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Testing notification badge...\n');
    
    // Navigate to the app
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle' 
    });
    
    // Wait for login or feed
    const loginVisible = await page.isVisible('button:has-text("Login")', { timeout: 5000 }).catch(() => false);
    
    if (loginVisible) {
      console.log('⚠️  Not logged in. Please login first and re-run the test.');
      await browser.close();
      return;
    }
    
    // Wait for header to load
    await page.waitForSelector('.header', { timeout: 10000 });
    
    // Check notification button and badge
    const notificationInfo = await page.evaluate(() => {
      const btn = document.querySelector('.notification-btn');
      const badge = document.querySelector('.notification-badge');
      
      const result = {
        buttonExists: !!btn,
        badgeExists: !!badge,
        badgeContent: badge?.textContent || null,
        badgeStyles: null,
        buttonStyles: null,
        issues: []
      };
      
      if (btn) {
        const btnStyles = window.getComputedStyle(btn);
        result.buttonStyles = {
          position: btnStyles.position,
          overflow: btnStyles.overflow,
          zIndex: btnStyles.zIndex
        };
        
        // Check common issues
        if (btnStyles.overflow === 'hidden') {
          result.issues.push('Button has overflow:hidden which may clip the badge');
        }
        if (btnStyles.position !== 'relative' && btnStyles.position !== 'absolute') {
          result.issues.push('Button should have position:relative for badge positioning');
        }
      }
      
      if (badge) {
        const badgeStyles = window.getComputedStyle(badge);
        result.badgeStyles = {
          position: badgeStyles.position,
          top: badgeStyles.top,
          right: badgeStyles.right,
          display: badgeStyles.display,
          backgroundColor: badgeStyles.backgroundColor,
          color: badgeStyles.color,
          fontSize: badgeStyles.fontSize,
          visibility: badgeStyles.visibility,
          opacity: badgeStyles.opacity,
          zIndex: badgeStyles.zIndex
        };
        
        // Check if badge is visible
        const rect = badge.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         badgeStyles.display !== 'none' && 
                         badgeStyles.visibility !== 'hidden' &&
                         parseFloat(badgeStyles.opacity) > 0;
        
        if (!isVisible) {
          result.issues.push('Badge is not visible on screen');
        }
        
        // Check positioning
        if (badgeStyles.position !== 'absolute') {
          result.issues.push('Badge should have position:absolute');
        }
      }
      
      return result;
    });
    
    console.log('📊 Results:\n');
    console.log('Button exists:', notificationInfo.buttonExists);
    console.log('Badge exists:', notificationInfo.badgeExists);
    
    if (notificationInfo.badgeContent) {
      console.log('Badge content:', notificationInfo.badgeContent);
    }
    
    if (notificationInfo.buttonStyles) {
      console.log('\n🔘 Button styles:');
      Object.entries(notificationInfo.buttonStyles).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (notificationInfo.badgeStyles) {
      console.log('\n🔴 Badge styles:');
      Object.entries(notificationInfo.badgeStyles).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (notificationInfo.issues.length > 0) {
      console.log('\n⚠️  Issues found:');
      notificationInfo.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    } else if (notificationInfo.badgeExists) {
      console.log('\n✅ No styling issues detected!');
    }
    
    // Take screenshots
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: `./test-screenshots/notification-test-${timestamp}.png`,
      clip: { x: 800, y: 0, width: 480, height: 100 }
    });
    
    console.log('\n📸 Screenshot saved to test-screenshots/');
    
    // Try to inject a test badge if none exists
    if (!notificationInfo.badgeExists) {
      console.log('\n🔧 Injecting test badge to verify styles...');
      
      await page.evaluate(() => {
        const btn = document.querySelector('.notification-btn');
        if (btn) {
          const badge = document.createElement('span');
          badge.className = 'notification-badge';
          badge.textContent = '5';
          btn.appendChild(badge);
        }
      });
      
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: `./test-screenshots/notification-test-injected-${timestamp}.png`,
        clip: { x: 800, y: 0, width: 480, height: 100 }
      });
      
      console.log('📸 Screenshot with injected badge saved');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔍 Keeping browser open for inspection. Press Ctrl+C to exit.');
    await new Promise(() => {}); // Keep browser open
  }
}

testNotificationBadge().catch(console.error);