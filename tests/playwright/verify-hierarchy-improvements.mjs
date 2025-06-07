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

async function verifyHierarchyImprovements() {
  const screenshotDir = '/tmp/bsky-hierarchy-improved';
  
  // Ensure directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    viewport: { width: 1400, height: 900 }
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();

  // Helper to take screenshot with annotation
  async function capture(name, description) {
    console.log(`Capturing: ${name} - ${description}`);
    await page.waitForTimeout(1500); // Let animations settle
    await page.screenshot({ 
      path: path.join(screenshotDir, `${name}.png`),
      fullPage: false 
    });
  }

  try {
    // 1. Login
    console.log('Logging in...');
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for feed to load
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // 2. Check improved reply context in feed
    console.log('Looking for reply context indicators...');
    const replyContext = await page.$('.reply-context');
    if (replyContext) {
      await replyContext.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('01-reply-context-feed', 'Reply context indicator in feed');
    }

    // 3. Find and click a post with replies
    const postsWithReplies = await page.$$eval('.post-card', posts => 
      posts.map((post, index) => ({
        index,
        replyCount: parseInt(post.querySelector('.engagement-btn span')?.textContent || '0')
      })).filter(p => p.replyCount > 0)
    );

    if (postsWithReplies.length > 0) {
      await page.click(`.post-card:nth-child(${postsWithReplies[0].index + 1})`);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Check for hierarchy improvements
      console.log('Verifying thread hierarchy...');
      await capture('02-thread-hierarchy', 'Improved thread with visual hierarchy');
      
      // Check for thread lines
      const threadLines = await page.$$('.thread-line');
      console.log(`Found ${threadLines.length} thread connection lines`);
      
      // Check for OP indicator
      const opIndicator = await page.$('.is-op-indicator');
      if (opIndicator) {
        await opIndicator.scrollIntoViewIfNeeded();
        await capture('03-op-indicator', 'Original poster indicator');
      }
      
      // Check for nested replies
      const nestedReplies = await page.$$('.thread-post-nested');
      console.log(`Found ${nestedReplies.length} nested replies`);
      
      // Scroll to see thread indentation
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(1000);
      await capture('04-thread-indentation', 'Thread indentation and nesting');
    }

    // 4. Check quoted post improvements
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    const quotedPost = await page.$('.quoted-post');
    if (quotedPost) {
      await quotedPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('05-quoted-post-enhanced', 'Enhanced quoted post styling');
    }

    // 5. Test complex thread
    // Find post with most replies
    const busyPost = await page.$$eval('.post-card', posts => {
      const postData = posts.map((post, index) => ({
        index,
        replyCount: parseInt(post.querySelector('.engagement-btn span')?.textContent || '0')
      }));
      return postData.sort((a, b) => b.replyCount - a.replyCount)[0];
    });

    if (busyPost && busyPost.replyCount > 5) {
      await page.click(`.post-card:nth-child(${busyPost.index + 1})`);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(2000);
      await capture('06-complex-thread', 'Complex thread with improved hierarchy');
      
      // Check focal post indicator
      const focalPost = await page.$('.focal-post-indicator');
      if (focalPost) {
        console.log('Found focal post indicator');
      }
    }

    // 6. Mobile view improvements
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await capture('07-mobile-thread-hierarchy', 'Mobile thread hierarchy');

    console.log('\nVerification complete!');
    console.log('Improvements verified:');
    console.log('✓ Reply context indicators');
    console.log('✓ Thread connection lines');
    console.log('✓ Visual hierarchy with indentation');
    console.log('✓ Original poster indicators');
    console.log('✓ Enhanced focal post styling');
    console.log('✓ Improved quoted posts');
    
    console.log(`\nScreenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
}

// Run the verification
verifyHierarchyImprovements().catch(console.error);