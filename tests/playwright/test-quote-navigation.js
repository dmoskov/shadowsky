// Test script to debug quote post navigation
// Run this in the browser console after logging in

async function testQuoteNavigation() {
  console.log("=== Testing Quote Post Navigation ===");

  // Wait for page to load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Find all quoted posts
  const quotedPosts = document.querySelectorAll(".quoted-post");
  console.log(`Found ${quotedPosts.length} quoted posts on the page`);

  if (quotedPosts.length === 0) {
    console.log(
      "No quoted posts found. Navigate to a page with quoted posts first.",
    );
    return;
  }

  // Get the first quoted post
  const firstQuoted = quotedPosts[0];
  console.log("First quoted post element:", firstQuoted);

  // Check if it has click handlers
  const events = getEventListeners(firstQuoted);
  console.log("Event listeners on quoted post:", events);

  // Simulate a click
  console.log("Simulating click on quoted post...");
  firstQuoted.click();

  // Wait and check if navigation happened
  setTimeout(() => {
    console.log("Current URL after click:", window.location.href);
    console.log(
      "Did navigation occur?",
      window.location.href.includes("/thread/"),
    );
  }, 1000);
}

// Helper function to check navigation state
function checkNavigationState() {
  const currentPath = window.location.pathname;
  console.log("Current path:", currentPath);
  console.log("Is on thread page:", currentPath.startsWith("/thread/"));
  console.log("React Router location:", window.location);
}

console.log("Test script loaded. Run testQuoteNavigation() to test.");
console.log("Run checkNavigationState() to check current navigation state.");
