import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function debugThreadNavigation() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newContext().then(c => c.newPage());
  
  try {
    console.log('🔍 Debugging thread navigation...\n');
    
    // Navigate and login
    await page.goto('http://localhost:5173');
    
    const credentialsPath = path.join(__dirname, '../../.test-credentials');
    const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
    
    const lines = credentialsContent.split('\n');
    let identifier = '';
    let password = '';
    
    for (const line of lines) {
      if (line.startsWith('TEST_USER=')) {
        identifier = line.split('=')[1].trim();
      } else if (line.startsWith('TEST_PASS=')) {
        password = line.split('=')[1].trim();
      }
    }
    
    await page.fill('input[placeholder="Username or email"]', identifier);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for feed
    await page.waitForSelector('.feed-container', { timeout: 15000 });
    console.log('✅ Logged in and feed loaded');
    
    // Get current URL
    console.log('Current URL:', page.url());
    
    // Find first post
    const firstPost = await page.locator('.post-card').first();
    
    // Add click listener to debug navigation
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        console.log('📍 Navigated to:', frame.url());
      }
    });
    
    // Listen for console messages
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('📝 Console:', msg.text());
      }
    });
    
    console.log('\n🖱️ Clicking first post...');
    await firstPost.click();
    
    // Wait a bit and check what's visible
    await page.waitForTimeout(3000);
    
    console.log('\n🔍 Checking visible elements:');
    const elements = {
      'Feed container': await page.locator('.feed-container').isVisible(),
      'Thread container': await page.locator('.thread-container').isVisible(),
      'Thread posts': await page.locator('.thread-posts').isVisible(),
      'Error state': await page.locator('.error-state').isVisible(),
      'Loading state': await page.locator('.thread-loading').isVisible(),
    };
    
    for (const [name, visible] of Object.entries(elements)) {
      console.log(`- ${name}: ${visible ? '✅ visible' : '❌ not visible'}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/debug-thread-nav.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved: debug-thread-nav.png');
    
    // Check URL again
    console.log('\nFinal URL:', page.url());
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n👀 Browser left open for inspection. Close manually when done.');
  }
}

debugThreadNavigation().catch(console.error);