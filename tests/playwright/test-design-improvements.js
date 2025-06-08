import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testDesignImprovements() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🚀 Testing design improvements...');
    
    // Navigate to the app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Check if we need to login
    const needsLogin = await page.locator('.login-container').isVisible().catch(() => false);
    
    if (needsLogin) {
      console.log('📱 Logging in...');
      // Read test credentials
      const credentialsPath = path.join(__dirname, '../../.test-credentials');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      
      await page.fill('[name="identifier"]', credentials.identifier);
      await page.fill('[name="password"]', credentials.password);
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    }
    
    // Wait for feed to load
    try {
      await page.waitForSelector('.post-card', { timeout: 10000 });
      console.log('✅ Feed loaded');
    } catch (error) {
      console.log('⚠️ No posts found, checking page state...');
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
      console.log('Current URL:', page.url());
      
      // Check for common elements
      const hasHeader = await page.locator('.header').isVisible();
      const hasSidebar = await page.locator('.sidebar').isVisible();
      const hasFeed = await page.locator('.feed-container').isVisible();
      console.log(`Header: ${hasHeader}, Sidebar: ${hasSidebar}, Feed: ${hasFeed}`);
    }
    
    // Test 1: Check spacing system
    console.log('\n📏 Testing spacing system...');
    const postCard = await page.locator('.post-card').first();
    const spacing = await postCard.evaluate(el => window.getComputedStyle(el).padding);
    console.log(`  Post card padding: ${spacing}`);
    
    // Test 2: Check hover states
    console.log('\n🖱️ Testing hover states...');
    await postCard.hover();
    await page.waitForTimeout(100);
    const hoverBg = await postCard.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log(`  Hover background: ${hoverBg}`);
    
    // Test 3: Check tooltips on engagement buttons
    console.log('\n💬 Testing tooltips...');
    const likeButton = await page.locator('.engagement-btn.like-btn').first();
    await likeButton.hover();
    await page.waitForTimeout(300); // Wait for tooltip delay
    const tooltipVisible = await page.locator('.tooltip-container:has-text("Like")').isVisible();
    console.log(`  Like tooltip visible: ${tooltipVisible}`);
    
    // Test 4: Check image grid layouts
    console.log('\n🖼️ Testing image grids...');
    const imageContainers = await page.locator('.post-images').all();
    console.log(`  Found ${imageContainers.length} posts with images`);
    
    // Test 5: Check mobile bottom navigation (resize to mobile)
    console.log('\n📱 Testing mobile navigation...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const mobileTabBar = await page.locator('.mobile-tab-bar').isVisible();
    console.log(`  Mobile tab bar visible: ${mobileTabBar}`);
    
    // Take screenshots
    console.log('\n📸 Taking screenshots...');
    
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-screenshots/design-improvements-desktop.png', fullPage: false });
    console.log('  ✅ Desktop screenshot saved');
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-screenshots/design-improvements-mobile.png', fullPage: false });
    console.log('  ✅ Mobile screenshot saved');
    
    // Hover state
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    const firstPost = await page.locator('.post-card').first();
    await firstPost.hover();
    await page.screenshot({ path: 'test-screenshots/design-improvements-hover.png', fullPage: false });
    console.log('  ✅ Hover state screenshot saved');
    
    console.log('\n✨ All design improvements tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'test-screenshots/design-improvements-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Run the test
testDesignImprovements().catch(console.error);