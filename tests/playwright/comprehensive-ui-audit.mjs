import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// Screenshots will be saved to progress/screenshots/ following project conventions
const screenshotDir = path.join(process.cwd(), 'progress/screenshots');

// Ensure directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function comprehensiveUIAudit() {
  console.log('🔍 Starting Comprehensive UI/UX Audit');
  console.log('📸 Screenshots will be saved to progress/screenshots/');
  
  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1280, height: 720 }
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Helper function to take screenshots with consistent naming
  async function takeScreenshot(name, description, options = {}) {
    console.log(`📸 ${description}`);
    await page.waitForTimeout(1000); // Let animations settle
    await page.screenshot({ 
      path: path.join(screenshotDir, `audit-${name}.png`),
      fullPage: options.fullPage || false,
      ...options
    });
  }

  try {
    // === LOGIN FLOW TESTING ===
    console.log('\n=== 1. LOGIN FLOW ===');
    
    await page.goto('http://127.0.0.1:5173/');
    await takeScreenshot('01-login-initial', 'Initial login page');
    
    // Test login form interactions
    await page.focus('input[placeholder="Username or email"]');
    await takeScreenshot('01-login-focused', 'Login form with focus state');
    
    // Fill in login form using project credentials
    await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[placeholder="Password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await takeScreenshot('01-login-filled', 'Login form filled out');
    
    await page.click('button[type="submit"]');
    console.log('Submitted login form');
    
    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await takeScreenshot('02-feed-loaded', 'Feed loaded after login');

    // === FEED FUNCTIONALITY TESTING ===
    console.log('\n=== 2. FEED FUNCTIONALITY ===');
    
    // Test feed overview
    await takeScreenshot('02-feed-overview', 'Complete feed overview', { fullPage: true });
    
    // Test hover states on posts
    const firstPost = await page.$('.post-card');
    if (firstPost) {
      await firstPost.hover();
      await takeScreenshot('02-feed-post-hover', 'Post hover state');
    }
    
    // Test engagement button hover states
    const replyBtn = await page.$('.engagement-btn');
    if (replyBtn) {
      await replyBtn.hover();
      await takeScreenshot('02-feed-engagement-hover', 'Engagement button hover state');
    }
    
    // === SIDEBAR NAVIGATION TESTING ===
    console.log('\n=== 3. SIDEBAR NAVIGATION ===');
    
    await takeScreenshot('03-sidebar-home', 'Sidebar in home state');
    
    // Test sidebar navigation
    const searchBtn = await page.$('.sidebar a[href="/search"]');
    if (searchBtn) {
      await searchBtn.hover();
      await takeScreenshot('03-sidebar-search-hover', 'Sidebar search hover');
      await searchBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot('03-search-page', 'Search page loaded');
    }
    
    // Test notifications
    const notifBtn = await page.$('.sidebar a[href="/notifications"]');
    if (notifBtn) {
      await notifBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot('03-notifications-page', 'Notifications page');
    }
    
    // Test profile navigation
    const profileBtn = await page.$('.sidebar a[href^="/profile"]');
    if (profileBtn) {
      await profileBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot('03-profile-page', 'Profile page');
    }
    
    // Return to home
    const homeBtn = await page.$('.sidebar a[href="/"]');
    if (homeBtn) {
      await homeBtn.click();
      await page.waitForTimeout(2000);
    }

    // === THREAD FUNCTIONALITY TESTING ===
    console.log('\n=== 4. THREAD FUNCTIONALITY ===');
    
    // Click on a post to open thread
    const posts = await page.$$('.post-card');
    if (posts.length > 0) {
      await posts[0].click();
      console.log('Clicked on first post to open thread');
      
      await page.waitForSelector('.thread-container', { timeout: 10000 });
      await takeScreenshot('04-thread-overview', 'Thread view overview');
      
      // Test thread navigation if present
      const threadNav = await page.$('.thread-navigation');
      if (threadNav) {
        await takeScreenshot('04-thread-navigation', 'Thread navigation controls');
      }
      
      // Test thread branch diagram if present
      const branchDiagram = await page.$('.thread-branch-diagram');
      if (branchDiagram) {
        await takeScreenshot('04-thread-diagram', 'Thread branch diagram');
      }
    }

    // === COMPOSE MODAL TESTING ===
    console.log('\n=== 5. COMPOSE MODAL ===');
    
    // Return to home for compose testing
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    const composeBtn = await page.$('button:has-text("Compose")');
    if (composeBtn) {
      await composeBtn.click();
      await page.waitForSelector('.compose-modal', { timeout: 5000 });
      await takeScreenshot('05-compose-modal', 'Compose modal opened');
      
      // Test compose form
      await page.fill('.compose-modal textarea', 'Test post content for UI audit');
      await takeScreenshot('05-compose-filled', 'Compose modal with content');
      
      // Close modal without posting
      const closeBtn = await page.$('.compose-modal button:has-text("Cancel")');
      if (closeBtn) {
        await closeBtn.click();
      }
    }

    // === RESPONSIVE TESTING ===
    console.log('\n=== 6. RESPONSIVE BEHAVIOR ===');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    await takeScreenshot('06-mobile-feed', 'Mobile feed layout');
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(2000);
    await takeScreenshot('06-tablet-feed', 'Tablet feed layout');
    
    // Test desktop wide
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(2000);
    await takeScreenshot('06-desktop-wide', 'Wide desktop layout');
    
    // Reset to standard desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(2000);

    // === HEADER AND SEARCH TESTING ===
    console.log('\n=== 7. HEADER FUNCTIONALITY ===');
    
    await takeScreenshot('07-header-overview', 'Header and search area');
    
    // Test search functionality
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.click();
      await takeScreenshot('07-search-focused', 'Search input focused');
      
      await searchInput.fill('test search');
      await takeScreenshot('07-search-filled', 'Search with content');
    }
    
    // Test user dropdown if present
    const userMenu = await page.$('.user-dropdown, .profile-menu');
    if (userMenu) {
      await userMenu.click();
      await takeScreenshot('07-user-dropdown', 'User dropdown menu');
    }

    // === ERROR STATES AND EDGE CASES ===
    console.log('\n=== 8. ERROR STATES ===');
    
    // Test offline state (if implemented)
    await page.setOfflineMode(true);
    await page.reload();
    await takeScreenshot('08-offline-state', 'Offline error state');
    await page.setOfflineMode(false);
    
    // === FINAL OVERVIEW ===
    console.log('\n=== 9. FINAL STATE ===');
    
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    await takeScreenshot('09-final-overview', 'Final application state', { fullPage: true });

    console.log('\n✅ Comprehensive UI audit completed!');
    console.log(`📁 Screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    await takeScreenshot('error-state', 'Error state capture');
  } finally {
    await browser.close();
  }
}

// Run the audit
comprehensiveUIAudit();