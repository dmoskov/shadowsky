#!/usr/bin/env node

/**
 * Debug script to analyze notification loading issues
 * Run this script to check localStorage cache state and help diagnose glitchy loading
 */

// This script needs to be run in a browser console, not Node.js
console.log(`
=== NOTIFICATION DEBUG SCRIPT ===

Copy and paste this into your browser console while on the notifications app:

// Check localStorage state
function debugNotificationCache() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(\`🔍 [\${timestamp}] Starting notification cache debug...\`);
  
  // Check all localStorage keys
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('bsky_notifications')) {
      keys.push(key);
    }
  }
  
  console.log(\`📦 Found \${keys.length} notification-related keys:\`, keys);
  
  // Check cache info
  keys.forEach(key => {
    const value = localStorage.getItem(key);
    const size = new Blob([value]).size;
    console.log(\`  - \${key}: \${(size / 1024).toFixed(1)}KB\`);
    
    if (key.includes('expiry')) {
      const expiry = new Date(parseInt(value));
      const now = new Date();
      const remaining = expiry - now;
      console.log(\`    Expires: \${expiry.toLocaleString()} (\${Math.floor(remaining / 1000 / 60)} minutes remaining)\`);
    }
  });
  
  // Try to load cache data
  ['all', 'priority'].forEach(type => {
    const key = \`bsky_notifications_\${type}_v1\`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        const notificationCount = parsed.pages.reduce((sum, p) => sum + p.notifications.length, 0);
        console.log(\`✅ \${type} cache: \${notificationCount} notifications, \${parsed.pages.length} pages\`);
      } catch (e) {
        console.error(\`❌ Failed to parse \${type} cache:\`, e);
      }
    } else {
      console.log(\`❌ No \${type} cache found\`);
    }
  });
}

// Monitor React Query cache changes
function monitorQueryCache() {
  console.log('📊 Monitoring React Query cache changes...');
  console.log('Open React Query DevTools or check window.__REACT_QUERY_STATE__ if available');
  
  // Check if React Query DevTools is available
  if (window.__REACT_QUERY_DEVTOOLS_GLOBAL_STORE__) {
    const store = window.__REACT_QUERY_DEVTOOLS_GLOBAL_STORE__;
    console.log('React Query DevTools found!');
    
    // Get all queries
    const queries = Array.from(store.getState().queries.values());
    const notificationQueries = queries.filter(q => q.queryKey[0] === 'notifications');
    
    console.log(\`Found \${notificationQueries.length} notification queries:\`);
    notificationQueries.forEach(q => {
      console.log(\`  - Key: \${JSON.stringify(q.queryKey)}\`);
      console.log(\`    State: \${q.state.status}\`);
      console.log(\`    Data pages: \${q.state.data?.pages?.length || 0}\`);
      console.log(\`    Last updated: \${new Date(q.state.dataUpdatedAt).toLocaleTimeString()}\`);
    });
  }
}

// Run diagnostics
debugNotificationCache();
monitorQueryCache();

console.log('\\n💡 TIP: Run this periodically to see how cache state changes');
console.log('💡 Also check Network tab for unexpected API calls');
`);
