import { chromium } from 'playwright';

async function testThreadLines() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'log') {
      console.log(`Browser [${msg.type()}]:`, msg.text());
    }
  });
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    
    // Check if already logged in
    const feedExists = await page.$('.feed-posts');
    
    if (!feedExists) {
      console.log('Logging in...');
      await page.fill('input[type="text"]', 'bskyclienttest.bsky.social');
      await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.feed-posts', { timeout: 10000 });
    }
    
    // Wait for posts to load
    console.log('Waiting for posts...');
    await page.waitForTimeout(3000);
    
    // Find all posts with the is-reply class
    const replyPosts = await page.$$eval('.post-card.is-reply', posts => 
      posts.map((post, index) => {
        const hasThreadLine = !!post.querySelector('.post-author::before');
        const parentAbove = !!post.previousElementSibling?.classList.contains('parent-post');
        const computedStyle = window.getComputedStyle(post.querySelector('.post-author'), '::before');
        
        return {
          index,
          hasIsReplyClass: true,
          hasParentPostAbove: parentAbove,
          hasVisibleThreadLine: computedStyle.content !== 'none',
          authorText: post.querySelector('.author-display-name')?.textContent || 'Unknown'
        };
      })
    );
    
    console.log('\nReply posts analysis:', replyPosts);
    
    // Check CSS rules
    const cssRules = await page.evaluate(() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('is-reply')) {
              rules.push({
                selector: rule.selectorText,
                styles: rule.style.cssText
              });
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheets
        }
      }
      return rules;
    });
    
    console.log('\nCSS rules for is-reply:', cssRules.filter(r => r.styles.includes('content')));
    
    // Inspect specific problematic posts
    const problemPosts = await page.$$eval('.post-card', posts => {
      return posts.map((post, index) => {
        const author = post.querySelector('.post-author');
        if (!author) return null;
        
        const beforeStyle = window.getComputedStyle(author, '::before');
        const hasContent = beforeStyle.content !== 'none' && beforeStyle.content !== '';
        
        if (hasContent && !post.previousElementSibling?.classList.contains('parent-post')) {
          return {
            index,
            authorName: post.querySelector('.author-display-name')?.textContent,
            hasIsReply: post.classList.contains('is-reply'),
            beforeContent: beforeStyle.content,
            beforeHeight: beforeStyle.height,
            beforeBackground: beforeStyle.backgroundColor,
            previousSibling: post.previousElementSibling?.className
          };
        }
        return null;
      }).filter(Boolean);
    });
    
    console.log('\nProblematic posts with thread lines:', problemPosts);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/thread-lines-test.png',
      fullPage: false 
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  console.log('\nBrowser staying open for inspection...');
  await page.waitForTimeout(30000);
  await browser.close();
}

testThreadLines().catch(console.error);