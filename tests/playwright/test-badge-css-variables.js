import { chromium } from 'playwright';
import fs from 'fs';

async function testBadgeCSSVariables() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Load credentials
    const creds = fs.readFileSync('.test-credentials', 'utf8');
    const username = creds.match(/TEST_USER=(.+)/)[1];
    const password = creds.match(/TEST_PASS=(.+)/)[1];
    
    console.log('1. Navigating and logging in...');
    await page.goto('http://localhost:5173');
    
    if (await page.isVisible('button').catch(() => false)) {
      await page.fill('input[placeholder*="Username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.header', { timeout: 10000 });
    }
    
    console.log('2. Checking CSS variables...');
    
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      
      return {
        // Get all color variables
        colorError: computed.getPropertyValue('--color-error'),
        colorBgPrimary: computed.getPropertyValue('--color-bg-primary'),
        colorBrand: computed.getPropertyValue('--color-brand'),
        
        // Check if CSS file is loaded
        hasDesignSystem: Array.from(document.styleSheets).some(sheet => {
          try {
            return sheet.href?.includes('design-system') || 
                   Array.from(sheet.cssRules || []).some(rule => 
                     rule.cssText?.includes('--color-error'));
          } catch (e) {
            return false;
          }
        })
      };
    });
    
    console.log('\n📊 CSS Variables:');
    console.log('--color-error:', cssVariables.colorError || 'NOT DEFINED');
    console.log('--color-bg-primary:', cssVariables.colorBgPrimary || 'NOT DEFINED');
    console.log('--color-brand:', cssVariables.colorBrand || 'NOT DEFINED');
    console.log('Design system loaded?', cssVariables.hasDesignSystem);
    
    console.log('\n3. Injecting test badge with direct styles...');
    
    // Test 1: Badge with CSS variable
    await page.evaluate(() => {
      const btn = document.querySelector('.notification-btn');
      if (btn) {
        btn.style.overflow = 'visible';
        btn.innerHTML = btn.innerHTML.replace(/<span class="notification-badge">.*?<\/span>/g, '');
        
        const badge1 = document.createElement('span');
        badge1.className = 'notification-badge';
        badge1.textContent = '3';
        badge1.id = 'test-badge-1';
        btn.appendChild(badge1);
      }
    });
    
    // Get computed styles of CSS variable badge
    const badge1Styles = await page.evaluate(() => {
      const badge = document.querySelector('#test-badge-1');
      if (!badge) return null;
      const styles = getComputedStyle(badge);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        actualBgColor: badge.style.backgroundColor || 'using CSS'
      };
    });
    
    console.log('\n4. Badge with CSS variables:');
    console.log('Background color:', badge1Styles?.backgroundColor);
    console.log('Text color:', badge1Styles?.color);
    
    // Test 2: Badge with inline styles
    await page.evaluate(() => {
      const btn = document.querySelector('.notification-btn');
      if (btn) {
        const badge2 = document.createElement('span');
        badge2.className = 'notification-badge';
        badge2.textContent = '5';
        badge2.style.backgroundColor = '#FF3B30';
        badge2.style.color = 'white';
        badge2.style.marginLeft = '10px';
        badge2.id = 'test-badge-2';
        btn.appendChild(badge2);
      }
    });
    
    console.log('\n5. Badge with inline red background added for comparison');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/badge-css-test.png',
      fullPage: false,
      clip: { x: 700, y: 0, width: 400, height: 100 }
    });
    console.log('📸 Screenshot saved');
    
    // Final check - what's actually in the CSS
    const cssRules = await page.evaluate(() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.cssText?.includes('notification-badge')) {
              rules.push(rule.cssText);
            }
          }
        } catch (e) {}
      }
      return rules;
    });
    
    console.log('\n6. CSS rules for notification-badge:');
    cssRules.forEach(rule => console.log(rule));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\n✅ Test complete. Browser staying open for inspection.');
  await new Promise(() => {});
}

testBadgeCSSVariables();