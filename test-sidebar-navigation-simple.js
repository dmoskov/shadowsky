import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read test credentials
const credentialsPath = path.join(__dirname, '.test-credentials');
const credentials = fs.readFileSync(credentialsPath, 'utf8');
const [, username] = credentials.match(/TEST_USER=(.+)/) || [];
const [, password] = credentials.match(/TEST_PASS=(.+)/) || [];

async function testSidebarNavigation() {
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  
  // Ensure directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();

  // Helper to take screenshot
  async function capture(name, description) {
    console.log(`📸 ${description}`);
    await page.waitForTimeout(1000); // Let animations settle
    await page.screenshot({ 
      path: path.join(screenshotDir, `${name}.png`),
      fullPage: false 
    });
  }

  try {
    console.log('🧪 Bluesky Sidebar Navigation Test\n');

    // 1. Login
    console.log('1️⃣  Logging in...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2. Desktop view with sidebar
    console.log('\n2️⃣  Testing desktop view...');
    await capture('sidebar-desktop-home', 'Desktop view with sidebar - Home page');

    // 3. Click compose button in sidebar
    console.log('\n3️⃣  Testing compose button...');
    const composeBtn = await page.$('.sidebar .compose-btn');
    if (composeBtn) {
      await composeBtn.click();
      await page.waitForSelector('.compose-modal', { timeout: 5000 });
      await capture('sidebar-compose-modal', 'Compose modal opened from sidebar');
      
      // Close modal with Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // 4. Test different screen sizes
    console.log('\n4️⃣  Testing responsive design...');
    
    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1000);
    await capture('sidebar-responsive-desktop', 'Desktop view (1280x800)');
    
    // Large desktop (1920x1080)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await capture('sidebar-responsive-large', 'Large desktop view (1920x1080)');
    
    // Tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await capture('sidebar-responsive-tablet', 'Tablet view (768x1024)');
    
    // Mobile (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await capture('sidebar-responsive-mobile', 'Mobile view (375x812)');
    
    // Check for mobile menu
    const mobileMenuBtn = await page.$('[aria-label="Menu"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(1000);
      await capture('sidebar-mobile-menu-open', 'Mobile menu opened');
    }

    // 5. Test navigation items at desktop size
    console.log('\n5️⃣  Testing navigation items...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(2000);
    
    // Navigate to Search
    const searchLink = await page.$('.nav-item[href="/search"]');
    if (searchLink) {
      await searchLink.click();
      await page.waitForTimeout(1500);
      await capture('sidebar-nav-search', 'Search page with sidebar');
    }
    
    // Navigate to Notifications
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForTimeout(1000);
    const notificationsLink = await page.$('.nav-item[href="/notifications"]');
    if (notificationsLink) {
      await notificationsLink.click();
      await page.waitForTimeout(1500);
      await capture('sidebar-nav-notifications', 'Notifications page with sidebar');
    }
    
    // Check notification badge
    const badge = await page.$('.nav-item[href="/notifications"] .nav-badge');
    if (badge) {
      const badgeText = await badge.textContent();
      console.log(`   ✓ Notification badge shows: ${badgeText}`);
    }

    console.log('\n✅ Test completed successfully!');
    
    // List captured screenshots
    const screenshots = fs.readdirSync(screenshotDir)
      .filter(file => file.startsWith('sidebar-') && file.endsWith('.png'))
      .sort();
    
    console.log('\n📁 Screenshots saved:');
    screenshots.forEach(file => {
      console.log(`   - ${file}`);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await capture('sidebar-error-state', 'Error state');
  } finally {
    await browser.close();
  }
}

// Run the test
testSidebarNavigation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});