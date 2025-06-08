import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testThreadClean() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🧪 Testing new thread-clean.css...\n');
    
    // Navigate to the app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Check if we need to login
    const needsLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (needsLogin) {
      console.log('📝 Logging in...');
      const credentialsPath = path.join(__dirname, '../../.test-credentials');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      await page.fill('[name="identifier"]', credentials.identifier);
      await page.fill('[name="password"]', credentials.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    }
    
    // Wait for feed
    console.log('📡 Waiting for feed...');
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    
    // Find a post with replies
    console.log('🔍 Looking for a post with replies...');
    const postWithReplies = await page.locator('.post-card').filter({ 
      has: page.locator('.post-engagement span').filter({ hasText: /^[1-9]\d*$/ }).first()
    }).first();
    
    if (await postWithReplies.isVisible()) {
      console.log('✅ Found post with replies, clicking...');
      await postWithReplies.click();
      
      // Wait for thread to load
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1000); // Let animations complete
      
      // Take screenshots
      console.log('📸 Taking screenshots...');
      
      // Full thread view
      await page.screenshot({ 
        path: 'test-screenshots/thread-clean-full.png',
        fullPage: true 
      });
      console.log('✅ Full thread screenshot saved');
      
      // Check for specific elements
      const checks = {
        'Thread container': await page.locator('.thread-container').isVisible(),
        'Thread posts wrapper': await page.locator('.thread-posts').isVisible(),
        'Main post': await page.locator('.thread-main-post').isVisible(),
        'Reply section': await page.locator('.thread-replies').isVisible(),
        'Nested replies': await page.locator('.thread-post-nested').count() > 0,
        'Depth indentation': await page.locator('[class*="depth-"]').count() > 0,
      };
      
      console.log('\n📊 Element checks:');
      for (const [element, present] of Object.entries(checks)) {
        console.log(`  ${present ? '✅' : '❌'} ${element}`);
      }
      
      // Check for OP badges
      const opBadges = await page.locator('.thread-reply.is-op').count();
      if (opBadges > 0) {
        console.log(`  ✅ OP badges found: ${opBadges}`);
      }
      
      // Take focused screenshots
      const mainPost = await page.locator('.thread-main-post').first();
      if (await mainPost.isVisible()) {
        await mainPost.screenshot({ 
          path: 'test-screenshots/thread-clean-main-post.png' 
        });
        console.log('✅ Main post screenshot saved');
      }
      
      // Screenshot nested replies
      const nestedSection = await page.locator('.thread-children').first();
      if (await nestedSection.isVisible()) {
        await nestedSection.screenshot({ 
          path: 'test-screenshots/thread-clean-nested.png' 
        });
        console.log('✅ Nested replies screenshot saved');
      }
      
    } else {
      console.log('⚠️ No posts with replies found in current feed');
    }
    
    console.log('\n✨ Thread CSS test complete!');
    console.log('Check test-screenshots/ folder for results');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ 
      path: 'test-screenshots/thread-clean-error.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

// Run the test
testThreadClean().catch(console.error);