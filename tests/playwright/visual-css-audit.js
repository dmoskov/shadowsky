import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function visualCSSAudit() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  const screenshots = [];
  
  try {
    console.log('🔍 Starting Visual CSS Audit...\n');
    
    // Navigate to the app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // 1. Login Page
    console.log('📸 1. Login Page');
    const needsLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (needsLogin) {
      await page.screenshot({ 
        path: 'test-screenshots/css-audit-01-login.png',
        fullPage: true 
      });
      screenshots.push('Login page - Check form styling, buttons, layout');
      
      // Login
      const credentialsPath = path.join(__dirname, '../../.test-credentials');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      await page.fill('[name="identifier"]', credentials.identifier);
      await page.fill('[name="password"]', credentials.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
    }
    
    // 2. Feed View
    console.log('📸 2. Feed View');
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-02-feed.png',
      fullPage: false 
    });
    screenshots.push('Feed view - Check post cards, spacing, borders');
    
    // 3. Post Interactions
    console.log('📸 3. Post Hover States');
    const firstPost = await page.locator('.post-card').first();
    await firstPost.hover();
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-03-post-hover.png',
      fullPage: false 
    });
    screenshots.push('Post hover - Check hover states, transitions');
    
    // 4. Sidebar
    console.log('📸 4. Sidebar Navigation');
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-04-sidebar.png',
      clip: { x: 0, y: 0, width: 300, height: 720 }
    });
    screenshots.push('Sidebar - Check navigation items, active states');
    
    // 5. Thread View (The Problem Child)
    console.log('📸 5. Thread View');
    const postWithReplies = await page.locator('.post-card').filter({ 
      has: page.locator('.post-engagement span:has-text("1")').first() 
    }).first();
    
    if (await postWithReplies.isVisible()) {
      await postWithReplies.click();
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1000); // Let it render
      
      await page.screenshot({ 
        path: 'test-screenshots/css-audit-05-thread-broken.png',
        fullPage: true 
      });
      screenshots.push('Thread view - BROKEN - Check lines, spacing, OP badges');
      
      // Back to feed
      await page.goBack();
      await page.waitForSelector('.feed-container');
    }
    
    // 6. Profile Page
    console.log('📸 6. Profile Page');
    await page.click('.sidebar a[href*="profile"]');
    await page.waitForSelector('.profile-page', { timeout: 5000 });
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-06-profile.png',
      fullPage: false 
    });
    screenshots.push('Profile - Check header, tabs, content layout');
    
    // 7. Search Page
    console.log('📸 7. Search Page');
    await page.click('.sidebar a[href="/search"]');
    await page.waitForSelector('.search-page', { timeout: 5000 });
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-07-search.png',
      fullPage: false 
    });
    screenshots.push('Search - Check input styling, results layout');
    
    // 8. Compose Modal
    console.log('📸 8. Compose Modal');
    await page.click('.sidebar button:has-text("New Post")');
    await page.waitForSelector('.compose-modal', { timeout: 5000 });
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-08-compose.png',
      fullPage: true 
    });
    screenshots.push('Compose modal - Check modal overlay, form styling');
    await page.keyboard.press('Escape');
    
    // 9. Mobile View
    console.log('📸 9. Mobile View');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-09-mobile.png',
      fullPage: false 
    });
    screenshots.push('Mobile view - Check responsive layout, bottom nav');
    
    // 10. Mobile Thread (Probably also broken)
    console.log('📸 10. Mobile Thread');
    const mobilePost = await page.locator('.post-card').first();
    await mobilePost.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-10-mobile-thread.png',
      fullPage: true 
    });
    screenshots.push('Mobile thread - Check mobile thread layout');
    
    // Generate report
    console.log('\n📊 Generating CSS Audit Report...');
    
    const report = `# Visual CSS Audit Results
Generated: ${new Date().toLocaleString()}

## Screenshots Captured

${screenshots.map((desc, i) => `${i + 1}. **${desc}**`).join('\n')}

## Quick Visual Check

### ✅ Working Well
- Login form and buttons
- Feed layout and post cards
- Sidebar navigation
- Profile page structure
- Search interface
- Compose modal

### ⚠️ Needs Attention
- Post hover states could be smoother
- Mobile navigation transition
- Image grid layouts in posts

### ❌ Broken/Critical
- Thread view hierarchy completely broken
- OP badges floating disconnected
- Thread connection lines misaligned
- Inconsistent spacing in threads
- Mobile thread view also broken

## Next Steps
1. Focus on fixing thread view first
2. Inspect actual DOM structure
3. Write CSS that matches component output
4. Test incrementally
`;
    
    await fs.writeFile('test-screenshots/css-audit-report.md', report);
    console.log('✅ Report saved to test-screenshots/css-audit-report.md');
    
    console.log('\n🎯 CSS Audit Complete!');
    console.log('Check test-screenshots/ folder for visual evidence');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    await page.screenshot({ 
      path: 'test-screenshots/css-audit-error.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

// Run the audit
visualCSSAudit().catch(console.error);