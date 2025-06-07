// Screenshot capture script for Bluesky client
// Run this in the browser console after logging in

async function captureAllScreenshots() {
  const screenshots = [];
  
  // Helper to wait
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper to capture current view
  async function captureView(name, description) {
    console.log(`Capturing: ${name}`);
    await wait(1000); // Let animations settle
    
    // Log the capture info
    screenshots.push({
      name: name,
      description: description,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
    
    // Take screenshot using Chrome DevTools
    console.log(`Please take a screenshot now and save as: ${name}.png`);
    await wait(3000); // Give time to take screenshot
  }
  
  // Start capturing
  console.log('Starting screenshot capture process...');
  console.log('Please take screenshots when prompted and save them to /tmp/bsky-screenshots/');
  
  // 1. Login screen (if not logged in)
  if (window.location.pathname === '/' && !document.querySelector('.feed-container')) {
    await captureView('01-login', 'Login screen');
  }
  
  // Navigate to home feed
  window.location.href = 'http://127.0.0.1:5173/';
  await wait(2000);
  
  // 2. Home feed
  await captureView('02-home-feed', 'Home feed with posts');
  
  // 3. Scroll down to show more posts
  window.scrollBy(0, 500);
  await wait(1000);
  await captureView('03-feed-scrolled', 'Feed after scrolling');
  
  // 4. Find a post with engagement
  const posts = document.querySelectorAll('.post-card');
  if (posts.length > 0) {
    posts[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(1000);
    await captureView('04-post-detail', 'Individual post with engagement metrics');
  }
  
  // 5. Click on a post to view thread
  if (posts.length > 0) {
    posts[0].click();
    await wait(2000);
    await captureView('05-thread-view', 'Thread view with replies');
  }
  
  // 6. Navigate to profile
  const profileLinks = document.querySelectorAll('.post-author-name');
  if (profileLinks.length > 0) {
    profileLinks[0].click();
    await wait(2000);
    await captureView('06-profile-view', 'User profile page');
  }
  
  // 7. Open compose modal
  const composeBtn = document.querySelector('.compose-fab');
  if (composeBtn) {
    composeBtn.click();
    await wait(1000);
    await captureView('07-compose-modal', 'Compose new post modal');
    
    // Close modal
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) closeBtn.click();
    await wait(500);
  }
  
  // 8. Navigate to search
  window.location.href = 'http://127.0.0.1:5173/search';
  await wait(2000);
  await captureView('08-search-page', 'Search interface');
  
  // 9. Navigate to notifications
  window.location.href = 'http://127.0.0.1:5173/notifications';
  await wait(2000);
  await captureView('09-notifications', 'Notifications page');
  
  // 10. Show a post with quoted content
  window.location.href = 'http://127.0.0.1:5173/';
  await wait(2000);
  const quotedPosts = document.querySelectorAll('.quoted-post');
  if (quotedPosts.length > 0) {
    quotedPosts[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(1000);
    await captureView('10-quoted-post', 'Post with quoted content');
  }
  
  // Save screenshot metadata
  console.log('Screenshot capture complete!');
  console.log('Metadata:', JSON.stringify(screenshots, null, 2));
  
  return screenshots;
}

// Instructions
console.log('=== Bluesky Screenshot Capture ===');
console.log('1. Make sure you are logged in');
console.log('2. Open Chrome DevTools');
console.log('3. Run: captureAllScreenshots()');
console.log('4. Take screenshots when prompted');
console.log('5. Save to /tmp/bsky-screenshots/');