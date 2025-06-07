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
      console.log('📝 Logging in with test credentials...');
      
      // Use test credentials from .test-credentials file
      await page.fill('input[placeholder*="Username"]', 'traviskimmel+bsky@gmail.com');
      await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForSelector('.header', { timeout: 10000 });
      console.log('✅ Logged in successfully');
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
    
    // Always inject a test badge for debugging
    console.log('\n🔧 Injecting test notification badge...');
    
    const injectionResult = await page.evaluate(() => {
      const btn = document.querySelector('.notification-btn');
      if (!btn) return { success: false, error: 'Button not found' };
      
      // Remove any existing badge first
      const existingBadge = btn.querySelector('.notification-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      // Create new badge
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.textContent = '3';
      
      // Ensure button has position relative for absolute positioning to work
      btn.style.position = 'relative';
      
      // Temporarily remove overflow hidden to see if that's the issue
      const originalOverflow = btn.style.overflow;
      btn.style.overflow = 'visible';
      
      btn.appendChild(badge);
      
      return { 
        success: true, 
        originalOverflow,
        buttonPosition: window.getComputedStyle(btn).position,
        badgeVisible: badge.offsetWidth > 0 && badge.offsetHeight > 0
      };
    });
    
    console.log('Injection result:', injectionResult);
    
    await page.waitForTimeout(500);
    
    // Take screenshot with injected badge
    await page.screenshot({ 
      path: `./test-screenshots/notification-test-injected-${timestamp}.png`,
      fullPage: true
    });
    console.log('📸 Screenshot with injected badge saved');
    
    // Now check the styles again with the injected badge
    const injectedBadgeInfo = await page.evaluate(() => {
      const badge = document.querySelector('.notification-badge');
      const btn = document.querySelector('.notification-btn');
      
      if (!badge || !btn) return null;
      
      const badgeStyles = window.getComputedStyle(badge);
      const btnStyles = window.getComputedStyle(btn);
      const rect = badge.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      
      return {
        badge: {
          position: badgeStyles.position,
          top: badgeStyles.top,
          right: badgeStyles.right,
          backgroundColor: badgeStyles.backgroundColor,
          color: badgeStyles.color,
          width: rect.width,
          height: rect.height,
          display: badgeStyles.display,
          visibility: badgeStyles.visibility,
          borderRadius: badgeStyles.borderRadius,
          zIndex: badgeStyles.zIndex
        },
        button: {
          position: btnStyles.position,
          overflow: btnStyles.overflow,
          width: btnRect.width,
          height: btnRect.height
        },
        isWithinButton: rect.right <= btnRect.right && rect.top >= btnRect.top
      };
    });
    
    if (injectedBadgeInfo) {
      console.log('\n🔴 Injected badge analysis:');
      console.log('Badge styles:', injectedBadgeInfo.badge);
      console.log('Button styles:', injectedBadgeInfo.button);
      console.log('Is badge within button bounds?', injectedBadgeInfo.isWithinButton);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🔍 Keeping browser open for inspection. Press Ctrl+C to exit.');
    await new Promise(() => {}); // Keep browser open
  }
}

testNotificationBadge().catch(console.error);