import { chromium } from 'playwright';
import * as fs from 'fs';

async function interactiveNotificationTest() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: false  // Start without devtools for cleaner UI
  });
  
  const page = await browser.newPage();
  
  // Ensure screenshot directory exists
  if (!fs.existsSync('./test-screenshots')) {
    fs.mkdirSync('./test-screenshots', { recursive: true });
  }
  
  try {
    console.log('🔍 Interactive Notification Badge Test\n');
    
    // Navigate to the app
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle' 
    });
    
    // Check if login is needed
    const needsLogin = await page.isVisible('button:has-text("Login")', { timeout: 3000 }).catch(() => false);
    
    if (needsLogin) {
      console.log('📝 Please login in the browser window.');
      console.log('   After logging in, press Enter here to continue...\n');
      
      // Wait for user input
      await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.once('data', () => {
          process.stdin.setRawMode(false);
          resolve();
        });
      });
    }
    
    // Wait for the app to stabilize after login
    await page.waitForSelector('.header', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give time for notifications to load
    
    console.log('✅ App loaded. Analyzing notification badge...\n');
    
    // Comprehensive analysis
    const analysis = await page.evaluate(() => {
      const btn = document.querySelector('.notification-btn');
      const badge = document.querySelector('.notification-badge');
      
      const result = {
        button: null,
        badge: null,
        cssRules: [],
        diagnostics: {
          buttonFound: !!btn,
          badgeFound: !!badge,
          badgeVisible: false,
          parentOverflow: null,
          zIndexIssue: false
        }
      };
      
      // Analyze button
      if (btn) {
        const btnRect = btn.getBoundingClientRect();
        const btnStyles = window.getComputedStyle(btn);
        
        result.button = {
          position: btnStyles.position,
          overflow: btnStyles.overflow,
          zIndex: btnStyles.zIndex,
          bounds: {
            top: btnRect.top,
            left: btnRect.left,
            width: btnRect.width,
            height: btnRect.height
          }
        };
        
        result.diagnostics.parentOverflow = btnStyles.overflow;
      }
      
      // Analyze badge
      if (badge) {
        const badgeRect = badge.getBoundingClientRect();
        const badgeStyles = window.getComputedStyle(badge);
        
        result.badge = {
          content: badge.textContent,
          position: badgeStyles.position,
          top: badgeStyles.top,
          right: badgeStyles.right,
          display: badgeStyles.display,
          visibility: badgeStyles.visibility,
          opacity: badgeStyles.opacity,
          backgroundColor: badgeStyles.backgroundColor,
          color: badgeStyles.color,
          fontSize: badgeStyles.fontSize,
          zIndex: badgeStyles.zIndex,
          bounds: {
            top: badgeRect.top,
            left: badgeRect.left,
            width: badgeRect.width,
            height: badgeRect.height
          }
        };
        
        // Check visibility
        result.diagnostics.badgeVisible = 
          badgeRect.width > 0 && 
          badgeRect.height > 0 && 
          badgeStyles.display !== 'none' && 
          badgeStyles.visibility !== 'hidden' &&
          parseFloat(badgeStyles.opacity) > 0;
        
        // Check z-index issues
        const btnZIndex = parseInt(result.button?.zIndex || '0');
        const badgeZIndex = parseInt(badgeStyles.zIndex || '0');
        if (badgeZIndex <= btnZIndex) {
          result.diagnostics.zIndexIssue = true;
        }
      }
      
      // Find all CSS rules affecting the badge
      try {
        for (const sheet of document.styleSheets) {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText?.includes('notification-badge')) {
              result.cssRules.push({
                selector: rule.selectorText,
                styles: rule.style.cssText
              });
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
      
      return result;
    });
    
    // Display results
    console.log('📊 Analysis Results:\n');
    console.log('Button found:', analysis.diagnostics.buttonFound ? '✅' : '❌');
    console.log('Badge found:', analysis.diagnostics.badgeFound ? '✅' : '❌');
    
    if (analysis.badge) {
      console.log('Badge visible:', analysis.diagnostics.badgeVisible ? '✅' : '❌');
      console.log('Badge content:', analysis.badge.content || '(empty)');
      
      console.log('\n🎨 Badge Styles:');
      Object.entries(analysis.badge).forEach(([key, value]) => {
        if (key !== 'bounds' && key !== 'content') {
          console.log(`  ${key}: ${value}`);
        }
      });
      
      console.log('\n📍 Badge Position:');
      console.log(`  Absolute: top=${analysis.badge.bounds.top}px, left=${analysis.badge.bounds.left}px`);
      console.log(`  Size: ${analysis.badge.bounds.width}x${analysis.badge.bounds.height}px`);
    }
    
    if (analysis.button) {
      console.log('\n🔘 Button Styles:');
      console.log(`  position: ${analysis.button.position}`);
      console.log(`  overflow: ${analysis.button.overflow}`);
      console.log(`  z-index: ${analysis.button.zIndex}`);
    }
    
    // Identify issues
    const issues = [];
    if (analysis.diagnostics.parentOverflow === 'hidden') {
      issues.push('Parent button has overflow:hidden - badge may be clipped');
    }
    if (analysis.diagnostics.zIndexIssue) {
      issues.push('Badge z-index is not higher than button');
    }
    if (!analysis.diagnostics.badgeVisible && analysis.diagnostics.badgeFound) {
      issues.push('Badge exists but is not visible');
    }
    if (analysis.button?.position !== 'relative') {
      issues.push('Button should have position:relative for proper badge positioning');
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  Issues Detected:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    // Take screenshots
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Full header screenshot
    const headerScreenshot = `./test-screenshots/notification-header-${timestamp}.png`;
    await page.screenshot({ 
      path: headerScreenshot,
      clip: { x: 0, y: 0, width: 1280, height: 100 }
    });
    console.log(`\n📸 Header screenshot: ${headerScreenshot}`);
    
    // Close-up of notification area
    if (analysis.button) {
      const closeupScreenshot = `./test-screenshots/notification-closeup-${timestamp}.png`;
      const bounds = analysis.button.bounds;
      await page.screenshot({ 
        path: closeupScreenshot,
        clip: { 
          x: Math.max(0, bounds.left - 10), 
          y: Math.max(0, bounds.top - 10), 
          width: bounds.width + 20, 
          height: bounds.height + 20 
        }
      });
      console.log(`📸 Closeup screenshot: ${closeupScreenshot}`);
    }
    
    // Try different approaches to trigger badge display
    console.log('\n🔄 Attempting to trigger notification update...');
    
    // Navigate to notifications and back
    await page.goto('http://localhost:5173/notifications', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check if badge appeared
    const badgeAfterNav = await page.$('.notification-badge');
    if (badgeAfterNav) {
      const afterNavScreenshot = `./test-screenshots/notification-after-nav-${timestamp}.png`;
      await page.screenshot({ 
        path: afterNavScreenshot,
        clip: { x: 800, y: 0, width: 480, height: 100 }
      });
      console.log(`📸 After navigation screenshot: ${afterNavScreenshot}`);
    }
    
    console.log('\n💡 Suggested Fixes:');
    console.log('1. Ensure .notification-btn has position:relative');
    console.log('2. Remove overflow:hidden from .notification-btn if present');
    console.log('3. Increase z-index on .notification-badge');
    console.log('4. Verify the notification count API is returning data');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    console.log('\n🔍 Browser remains open for manual inspection.');
    console.log('   Open DevTools (F12) to inspect elements.');
    console.log('   Press Ctrl+C to exit.\n');
    
    // Keep browser open
    await new Promise(() => {});
  }
}

// Enable graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

interactiveNotificationTest().catch(console.error);