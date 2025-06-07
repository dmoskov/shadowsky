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

async function captureHierarchyScreenshots() {
  const screenshotDir = '/tmp/bsky-hierarchy-screenshots';
  
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

    // 2. Find a post with replies in the feed
    console.log('Looking for posts with replies...');
    const postsWithReplies = await page.$$eval('.post-card', posts => 
      posts.map((post, index) => ({
        index,
        replyCount: parseInt(post.querySelector('.engagement-btn span')?.textContent || '0')
      })).filter(p => p.replyCount > 0)
    );

    if (postsWithReplies.length > 0) {
      // Click on a post with replies
      const postToClick = `.post-card:nth-child(${postsWithReplies[0].index + 1})`;
      await page.click(postToClick);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1500);
      await capture('01-simple-thread', 'Basic thread with replies');
      
      // Scroll to see more replies if available
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(1000);
      await capture('02-thread-scrolled', 'Thread view scrolled to show more replies');
    }

    // 3. Navigate back to feed and look for quoted posts
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Find quoted posts
    const quotedPost = await page.$('.quoted-post');
    if (quotedPost) {
      await quotedPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('03-quoted-post-feed', 'Quoted post in feed view');
      
      // Click the parent post to see context
      const parentPost = await quotedPost.evaluateHandle(el => el.closest('.post-card'));
      await parentPost.click();
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1500);
      await capture('04-quoted-post-thread', 'Quoted post in thread context');
    }

    // 4. Look for nested conversations
    // Navigate to a busy thread by searching for high reply counts
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
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
      await capture('05-complex-thread', 'Complex thread with multiple branches');
      
      // Try to find nested replies
      const nestedReply = await page.$('.thread-branch .thread-branch');
      if (nestedReply) {
        await nestedReply.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await capture('06-nested-replies', 'Nested reply chains');
      }
    }

    // 5. Check reply context indicators
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    // Find posts that are replies
    const replyPost = await page.$('.post-card.is-reply');
    if (replyPost) {
      await replyPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await capture('07-reply-in-feed', 'Reply post shown in main feed');
    }

    // 6. Mobile view of threads
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Navigate to a thread
    if (postsWithReplies.length > 0) {
      await page.goto('http://127.0.0.1:5173/');
      await page.waitForSelector('.feed-container', { timeout: 5000 });
      await page.click(`.post-card:nth-child(${postsWithReplies[0].index + 1})`);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1500);
      await capture('08-mobile-thread', 'Thread view on mobile');
    }

    // 7. Thread with mixed content (quotes, replies, media)
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    // Scroll through feed to find diverse content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }
    
    // Look for posts with multiple types of content
    const complexPost = await page.$eval('.feed-posts', feed => {
      const posts = feed.querySelectorAll('.post-card');
      for (let post of posts) {
        const hasQuote = post.querySelector('.quoted-post');
        const hasMedia = post.querySelector('.post-media');
        const hasReplies = parseInt(post.querySelector('.engagement-btn span')?.textContent || '0') > 0;
        if ((hasQuote || hasMedia) && hasReplies) {
          return Array.from(posts).indexOf(post);
        }
      }
      return -1;
    });

    if (complexPost >= 0) {
      await page.click(`.post-card:nth-child(${complexPost + 1})`);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(1500);
      await capture('09-mixed-content-thread', 'Thread with quotes, media, and replies');
    }

    // 8. Long thread view
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForSelector('.feed-container', { timeout: 5000 });
    
    // Scroll to load more posts and find a long thread
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1500);
    }
    
    const longThread = await page.$$eval('.post-card', posts => {
      const postData = posts.map((post, index) => ({
        index,
        replyCount: parseInt(post.querySelector('.engagement-btn span')?.textContent || '0')
      }));
      return postData.find(p => p.replyCount > 10);
    });

    if (longThread) {
      await page.click(`.post-card:nth-child(${longThread.index + 1})`);
      await page.waitForSelector('.thread-container', { timeout: 5000 });
      await page.waitForTimeout(2000);
      await capture('10-long-thread-top', 'Long thread - top view');
      
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      await capture('11-long-thread-bottom', 'Long thread - bottom view');
    }

    console.log('\nHierarchy screenshot capture complete!');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    
    // List captured screenshots
    const screenshots = fs.readdirSync(screenshotDir);
    console.log('\nCaptured screenshots:');
    screenshots.forEach(file => {
      if (file.endsWith('.png')) {
        console.log(`- ${file}`);
      }
    });

  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

// Run the capture
captureHierarchyScreenshots().catch(console.error);