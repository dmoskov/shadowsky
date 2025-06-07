// Test quote post navigation
// Paste this in the browser console

async function testQuotePostNavigation() {
  // First, let's check if we're logged in
  const isLoggedIn = window.location.pathname !== '/' || document.querySelector('.feed-container');
  
  if (!isLoggedIn) {
    console.log('Not logged in. Please log in first with:');
    console.log('Handle: clood41.bsky.social');
    console.log('Password: 5FFThQrGSYwz');
    return;
  }
  
  console.log('Logged in. Current path:', window.location.pathname);
  
  // If we're on the home feed, navigate to a profile to find quoted posts
  if (window.location.pathname === '/') {
    console.log('On home feed. Navigate to a profile or thread with quoted posts to test.');
    return;
  }
  
  // Find quoted posts
  const quotedPosts = document.querySelectorAll('.quoted-post');
  console.log(`Found ${quotedPosts.length} quoted posts`);
  
  if (quotedPosts.length > 0) {
    console.log('First quoted post:', quotedPosts[0]);
    
    // Add a visual indicator
    quotedPosts[0].style.border = '3px solid red';
    
    console.log('Click the red-bordered quoted post to test navigation');
    
    // Listen for the next navigation
    let currentPath = window.location.pathname;
    const checkInterval = setInterval(() => {
      if (window.location.pathname !== currentPath) {
        console.log('Navigation detected!');
        console.log('Old path:', currentPath);
        console.log('New path:', window.location.pathname);
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
  }
}

// Run the test
testQuotePostNavigation();