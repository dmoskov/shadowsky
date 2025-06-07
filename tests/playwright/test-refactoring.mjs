import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const screenshotDir = 'tests/screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function testRefactoredApp() {
  console.log('🧪 Testing refactored app...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // Use existing auth if available
    storageState: fs.existsSync('auth.json') ? 'auth.json' : undefined
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Test login page loads
    console.log('1️⃣ Testing login page...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const isLoggedIn = await page.locator('.header').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      await page.screenshot({ 
        path: path.join(screenshotDir, 'refactor-test-1-login.png'),
        fullPage: true 
      });
      console.log('   ✅ Login page loads correctly');
    } else {
      console.log('   ℹ️  Already logged in, skipping login test');
    }
    
    // 2. Test main app components
    if (isLoggedIn) {
      console.log('\n2️⃣ Testing authenticated app...');
      
      // Check header
      const header = await page.locator('.header').isVisible();
      console.log(`   ${header ? '✅' : '❌'} Header component loads`);
      
      // Check sidebar
      const sidebar = await page.locator('.sidebar').isVisible();
      console.log(`   ${sidebar ? '✅' : '❌'} Sidebar component loads`);
      
      // Check feed
      await page.waitForSelector('.feed-container', { timeout: 10000 }).catch(() => {});
      const feed = await page.locator('.feed-container').isVisible();
      console.log(`   ${feed ? '✅' : '❌'} Feed component loads`);
      
      // Take screenshot of main view
      await page.screenshot({ 
        path: path.join(screenshotDir, 'refactor-test-2-main.png'),
        fullPage: true 
      });
      
      // 3. Test compose modal
      console.log('\n3️⃣ Testing compose modal...');
      const composeButton = await page.locator('.compose-fab, .sidebar-compose-btn').first();
      if (await composeButton.isVisible()) {
        await composeButton.click();
        await page.waitForTimeout(500);
        
        const modal = await page.locator('.compose-modal').isVisible();
        console.log(`   ${modal ? '✅' : '❌'} Compose modal opens`);
        
        if (modal) {
          await page.screenshot({ 
            path: path.join(screenshotDir, 'refactor-test-3-compose.png'),
            fullPage: true 
          });
          
          // Close modal
          await page.locator('.compose-modal .modal-close').click();
          await page.waitForTimeout(300);
        }
      }
      
      // 4. Test thread view
      console.log('\n4️⃣ Testing thread view...');
      const firstPost = await page.locator('.post-card').first();
      if (await firstPost.isVisible()) {
        await firstPost.click();
        await page.waitForTimeout(1000);
        
        const threadView = await page.locator('.thread-view').isVisible();
        console.log(`   ${threadView ? '✅' : '❌'} Thread view opens`);
        
        if (threadView) {
          // Check for thread navigation
          const threadNav = await page.locator('.thread-navigation').isVisible();
          console.log(`   ${threadNav ? '✅' : '❌'} Thread navigation loads`);
          
          await page.screenshot({ 
            path: path.join(screenshotDir, 'refactor-test-4-thread.png'),
            fullPage: true 
          });
        }
      }
      
      // 5. Check console for errors
      console.log('\n5️⃣ Checking for console errors...');
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      if (consoleErrors.length === 0) {
        console.log('   ✅ No console errors detected');
      } else {
        console.log('   ❌ Console errors found:');
        consoleErrors.forEach(err => console.log(`      - ${err}`));
      }
    }
    
    console.log('\n✨ Refactoring test complete!');
    console.log(`📸 Screenshots saved to ${screenshotDir}/`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'refactor-test-error.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

// Run the test
testRefactoredApp().catch(console.error);