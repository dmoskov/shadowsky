import { chromium } from 'playwright';
import fs from 'fs';

async function testComponentsLoad() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: fs.existsSync('auth.json') ? 'auth.json' : undefined
  });
  
  const page = await context.newPage();
  
  console.log('🧪 Testing component loading after refactoring...\n');
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Check if we're on login or main app
    const isLoggedIn = await page.locator('.header').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      console.log('📝 On login page');
      
      // Check Login component loads from core/
      const loginForm = await page.locator('.login-form').isVisible();
      console.log(`   ${loginForm ? '✅' : '❌'} Login component (core/Login.tsx) loads`);
      
      // Login requires credentials from environment variables
      // Set VITE_TEST_IDENTIFIER and VITE_TEST_PASSWORD in .env.local
      console.log('   ℹ️  Login required - use getTestCredentials() helper');
    } else {
      console.log('✨ Already authenticated, testing main components:\n');
      
      // Test core components
      console.log('Core components:');
      const header = await page.locator('.header').isVisible();
      console.log(`   ${header ? '✅' : '❌'} Header (core/Header.tsx)`);
      
      const sidebar = await page.locator('.sidebar').isVisible();
      console.log(`   ${sidebar ? '✅' : '❌'} Sidebar (core/Sidebar.tsx)`);
      
      // Test feed components
      console.log('\nFeed components:');
      const feed = await page.locator('.feed-container').isVisible();
      console.log(`   ${feed ? '✅' : '❌'} Feed (feed/Feed.tsx)`);
      
      const postCards = await page.locator('.post-card').count();
      console.log(`   ${postCards > 0 ? '✅' : '❌'} PostCard (feed/PostCard.tsx) - ${postCards} found`);
      
      // Test UI components
      if (postCards === 0) {
        const emptyState = await page.locator('.empty-state').isVisible();
        console.log(`   ${emptyState ? '✅' : '❌'} EmptyStates (ui/EmptyStates.tsx)`);
      }
      
      // Test modals
      console.log('\nModal components:');
      const composeBtn = await page.locator('.compose-fab, .sidebar-compose-btn').first();
      if (await composeBtn.isVisible()) {
        await composeBtn.click();
        await page.waitForTimeout(500);
        const composeModal = await page.locator('.compose-modal').isVisible();
        console.log(`   ${composeModal ? '✅' : '❌'} ComposeModal (modals/ComposeModal.tsx)`);
        
        if (composeModal) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
      
      console.log('\n📸 Taking screenshot...');
      await page.screenshot({ 
        path: 'tests/screenshots/refactor-components-test.png',
        fullPage: true 
      });
    }
    
    console.log('\n✅ Component loading test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testComponentsLoad();