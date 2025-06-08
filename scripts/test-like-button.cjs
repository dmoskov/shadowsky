const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: {
      width: 1280,
      height: 800
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser console:', msg.type(), msg.text());
  });
  
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });
  
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  
  // Wait for feed to load
  await page.waitForTimeout(3000);
  
  // Check if logged in by looking for feed
  const feedExists = await page.$('.feed-container');
  
  if (!feedExists) {
    console.log('Not logged in - looking for login form');
    const loginForm = await page.$('.login-form');
    if (loginForm) {
      console.log('Login form found, app is working but needs login');
    } else {
      console.log('ERROR: No feed or login form found');
    }
  } else {
    console.log('Feed found - checking for posts');
    
    // Find the first like button
    const likeButton = await page.$('.like-btn');
    
    if (likeButton) {
      console.log('Like button found - clicking it');
      
      // Get initial like count
      const initialCount = await page.$eval('.like-btn span', el => el.textContent);
      console.log('Initial like count:', initialCount);
      
      // Click the like button
      await likeButton.click();
      
      // Wait for potential update
      await page.waitForTimeout(2000);
      
      // Check if count changed
      const newCount = await page.$eval('.like-btn span', el => el.textContent);
      console.log('New like count:', newCount);
      
      if (initialCount !== newCount) {
        console.log('SUCCESS: Like button is working!');
      } else {
        console.log('ISSUE: Like count did not change');
      }
    } else {
      console.log('No like button found in feed');
    }
  }
  
  // Keep browser open for inspection
  console.log('\nBrowser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();