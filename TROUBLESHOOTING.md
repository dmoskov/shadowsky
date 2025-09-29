# Troubleshooting Guide for ShadowSky

## Quick Fixes

### Clear Everything and Start Fresh

```javascript
// In browser console
localStorage.clear();
indexedDB.deleteDatabase("shadowsky");
location.reload();
```

### Enable Debug Mode

```javascript
// In browser console
window.enableDebug();
```

## Common Issues and Solutions

## Authentication Issues

### Problem: "Invalid identifier or password"

**Symptoms**: Can't log in despite correct credentials

**Solutions**:

1. **Check handle format**:
   - Use full handle: `username.bsky.social`
   - Or email address associated with account

2. **Try app password**:

   ```
   1. Go to Bluesky settings
   2. Create an app password
   3. Use app password instead of main password
   ```

3. **Check for typos**:
   - No extra spaces
   - Correct capitalization (handles are case-insensitive)

### Problem: "Session expired" loop

**Symptoms**: Constantly being logged out or asked to re-authenticate

**Solutions**:

1. **Clear session data**:

   ```javascript
   localStorage.removeItem("shadowsky_auth_session");
   location.reload();
   ```

2. **Check browser settings**:
   - Enable third-party cookies
   - Disable aggressive tracking protection
   - Add site to exceptions if needed

3. **Time sync issue**:
   - Verify system clock is correct
   - JWT tokens are time-sensitive

### Problem: "Network error" during login

**Symptoms**: Can't connect to Bluesky servers

**Solutions**:

1. **Check Bluesky status**: Visit https://bsky.social
2. **VPN/Proxy interference**: Disable and retry
3. **Custom PDS**: Ensure URL is correct and accessible
4. **Browser extensions**: Disable ad blockers temporarily

## Storage Issues

### Problem: "Storage quota exceeded"

**Symptoms**: Can't save bookmarks, settings don't persist

**Solutions**:

1. **Clear old data**:

   ```javascript
   // Clear notifications older than 30 days
   await notificationService.clearOldNotifications();
   ```

2. **Check available storage**:

   ```javascript
   navigator.storage.estimate().then((estimate) => {
     console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
   });
   ```

3. **Switch storage type**:
   - Go to Settings → Storage
   - Switch from local to AT Protocol storage
   - This moves data to cloud

### Problem: Storage sync conflicts

**Symptoms**: Data not syncing between devices

**Solutions**:

1. **Force sync**:

   ```javascript
   await bookmarkService.forceSync();
   await columnService.forceSync();
   ```

2. **Check storage preference**:
   - Settings → Storage → Ensure "AT Protocol" selected
   - Not "Local Storage" which is device-specific

3. **Verify authentication**:
   - Must be logged in for sync
   - Check session is valid

### Problem: Lost bookmarks after update

**Symptoms**: Bookmarks disappeared after app update

**Solutions**:

1. **Check storage type**:
   - May have switched from local to AT Protocol
   - Or vice versa

2. **Recover from backup**:

   ```javascript
   // Check for backup
   const backup = localStorage.getItem("shadowsky_bookmarks_backup");
   if (backup) {
     const bookmarks = JSON.parse(backup);
     // Restore bookmarks
   }
   ```

3. **Export/Import**:
   - Go to Settings → Data → Export bookmarks
   - Save JSON file
   - Import back if needed

## Performance Issues

### Problem: Slow loading/scrolling

**Symptoms**: Janky scrolling, delayed responses

**Solutions**:

1. **Clear cache**:

   ```javascript
   caches.keys().then((names) => {
     names.forEach((name) => caches.delete(name));
   });
   ```

2. **Reduce column count**:
   - SkyDeck → Remove unused columns
   - Mobile: Use single column mode

3. **Disable animations**:
   - Settings → Accessibility → Reduce motion

4. **Check memory usage**:
   ```javascript
   console.log(performance.memory);
   ```

### Problem: High memory usage

**Symptoms**: Browser tab crashes, "Aw, Snap!" errors

**Solutions**:

1. **Limit cached items**:

   ```javascript
   // Reduce cache size
   queryClient.setDefaultOptions({
     queries: {
       cacheTime: 5 * 60 * 1000, // 5 minutes
       staleTime: 2 * 60 * 1000, // 2 minutes
     },
   });
   ```

2. **Clear old notifications**:
   - Settings → Data → Clear old notifications

3. **Restart browser**:
   - Close all tabs
   - Restart browser
   - Memory leak workaround

### Problem: Infinite scroll not working

**Symptoms**: Can't load more posts at bottom of feed

**Solutions**:

1. **Check network**:
   - Open DevTools → Network tab
   - Look for failed requests

2. **Reset scroll position**:

   ```javascript
   window.scrollTo(0, 0);
   location.reload();
   ```

3. **Clear query cache**:
   ```javascript
   queryClient.clear();
   ```

## Display Issues

### Problem: Dark mode not working

**Symptoms**: Theme doesn't change or partially changes

**Solutions**:

1. **Force theme refresh**:

   ```javascript
   document.documentElement.classList.toggle("dark");
   ```

2. **Check system preference**:
   - Settings → Theme → Set to "Dark" not "System"

3. **Clear theme cache**:
   ```javascript
   localStorage.removeItem("shadowsky_theme");
   location.reload();
   ```

### Problem: Broken layout/overlapping elements

**Symptoms**: UI elements in wrong positions

**Solutions**:

1. **Hard refresh**:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Check zoom level**:
   - Reset zoom: `Ctrl/Cmd + 0`

3. **Disable browser extensions**:
   - Especially CSS modifiers
   - Ad blockers with cosmetic filtering

### Problem: Images not loading

**Symptoms**: Broken image icons, blank spaces

**Solutions**:

1. **Check content blocking**:
   - Disable ad blocker for site
   - Check browser privacy settings

2. **CORS issues**:
   - Check browser console for CORS errors
   - Proxy server may be down

3. **Clear image cache**:
   ```javascript
   // Force reload images
   document.querySelectorAll("img").forEach((img) => {
     img.src = img.src + "?t=" + Date.now();
   });
   ```

## Feature-Specific Issues

### Problem: Notifications not updating

**Symptoms**: New notifications don't appear

**Solutions**:

1. **Check WebSocket connection**:

   ```javascript
   // Check Jetstream status
   console.log(jetstreamService.isConnected());
   ```

2. **Force refresh**:

   ```javascript
   await notificationService.refresh();
   ```

3. **Check notification permissions**:
   - Browser may be blocking notifications
   - Settings → Notifications → Enable

### Problem: Can't send direct messages

**Symptoms**: DM feature unavailable or errors

**Solutions**:

1. **Check app password scope**:
   - Need app password with DM permissions
   - Create new app password with all scopes

2. **Verify DM availability**:
   - Feature may be disabled for your account
   - Check Bluesky settings

### Problem: Bookmarks not saving

**Symptoms**: Bookmark button doesn't work

**Solutions**:

1. **Check storage type**:

   ```javascript
   console.log(await preferenceService.getBookmarkStorageType());
   ```

2. **Verify authentication**:
   - Must be logged in
   - Session must be valid

3. **Check for errors**:
   ```javascript
   // Enable debug mode and retry
   window.enableDebug();
   // Watch console for errors
   ```

### Problem: Analytics not showing data

**Symptoms**: Empty charts, no metrics

**Solutions**:

1. **Wait for data collection**:
   - Need at least 24 hours of usage
   - Data processes periodically

2. **Check IndexedDB**:
   ```javascript
   // Verify data exists
   const db = await openDB("shadowsky");
   const count = await db.count("analytics");
   console.log(`Analytics records: ${count}`);
   ```

## Development Issues

### Problem: `npm install` fails

**Symptoms**: Dependency installation errors

**Solutions**:

1. **Clear npm cache**:

   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Node version**:

   ```bash
   node --version  # Should be 18+
   ```

3. **Use different registry**:
   ```bash
   npm install --registry https://registry.npmjs.org/
   ```

### Problem: Build fails

**Symptoms**: TypeScript errors, build errors

**Solutions**:

1. **Type errors**:

   ```bash
   # Check types without building
   npm run test:types
   ```

2. **Clear build cache**:

   ```bash
   rm -rf dist .wireit
   npm run build
   ```

3. **Check for missing dependencies**:
   ```bash
   npm ls
   ```

### Problem: Tests failing locally but pass in CI

**Symptoms**: Inconsistent test results

**Solutions**:

1. **Match CI environment**:

   ```bash
   # Clean install like CI
   rm -rf node_modules
   npm ci
   npm test
   ```

2. **Check timezone**:

   ```bash
   # Set timezone for tests
   TZ=UTC npm test
   ```

3. **Clear test cache**:
   ```bash
   npx vitest --clearCache
   ```

### Problem: Hot reload not working

**Symptoms**: Changes don't appear without manual refresh

**Solutions**:

1. **Check Vite HMR**:
   - Ensure WebSocket not blocked
   - Check browser console for HMR errors

2. **File watching issues**:

   ```bash
   # Increase watchers limit (Linux)
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

3. **Restart dev server**:
   ```bash
   # Kill all node processes
   pkill node
   npm run dev
   ```

## Browser-Specific Issues

### Chrome/Edge

- **Issue**: Extension conflicts
- **Solution**: Try incognito mode without extensions

### Firefox

- **Issue**: Enhanced tracking protection
- **Solution**: Add site to exceptions

### Safari

- **Issue**: Intelligent Tracking Prevention
- **Solution**: Disable for localhost

### Mobile Browsers

- **Issue**: Limited storage
- **Solution**: Use AT Protocol storage instead of local

## Debugging Tools

### Browser Console Commands

```javascript
// Debug mode
window.enableDebug();

// View all stored data
window.inspectStorage = () => {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    storage[key] = localStorage.getItem(key);
  }
  console.table(storage);
};

// Clear specific data types
window.clearBookmarks = () => {
  localStorage.removeItem("shadowsky_bookmarks");
  indexedDB.deleteDatabase("shadowsky-bookmarks");
};

// Force refresh all data
window.forceRefresh = async () => {
  queryClient.clear();
  await queryClient.refetchQueries();
};

// Check service status
window.checkServices = () => {
  console.log("Auth:", !!authService.session);
  console.log("Bookmarks:", bookmarkService.isInitialized);
  console.log("Notifications:", notificationService.isInitialized);
  console.log("Jetstream:", jetstreamService.isConnected());
};
```

### Network Debugging

```javascript
// Log all API calls
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log("Fetch:", args[0]);
  const response = await originalFetch(...args);
  console.log("Response:", response.status);
  return response;
};
```

### React Query DevTools

```javascript
// Show React Query DevTools
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// Add to app: <ReactQueryDevtools />
```

## Getting More Help

### Before Asking for Help

1. **Check this guide**: Read through relevant sections
2. **Search existing issues**: GitHub issues may have solutions
3. **Enable debug mode**: Get detailed error messages
4. **Gather information**:
   ```javascript
   // System info
   console.log({
     userAgent: navigator.userAgent,
     platform: navigator.platform,
     language: navigator.language,
     cookieEnabled: navigator.cookieEnabled,
     onLine: navigator.onLine,
     storage: await navigator.storage.estimate(),
   });
   ```

### How to Report Issues

Include:

1. **Browser and version**
2. **Operating system**
3. **Steps to reproduce**
4. **Expected vs actual behavior**
5. **Console errors** (F12 → Console)
6. **Network errors** (F12 → Network)
7. **Screenshots** if UI issue

### Where to Get Help

1. **GitHub Issues**: Bug reports
2. **GitHub Discussions**: Questions
3. **Discord**: Real-time help (if available)
4. **Documentation**: README, ARCHITECTURE, CONTEXT

## Emergency Recovery

### Complete Reset

```bash
# 1. Backup data
# Export bookmarks/settings first if possible

# 2. Clear everything
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('shadowsky');
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});

# 3. Hard refresh
location.reload(true);

# 4. Re-login and reconfigure
```

### Data Recovery

```javascript
// Check for backups
const checkBackups = () => {
  const keys = Object.keys(localStorage);
  const backups = keys.filter((k) => k.includes("backup"));
  console.log("Found backups:", backups);
  backups.forEach((key) => {
    console.log(key, localStorage.getItem(key));
  });
};

checkBackups();
```

---

_If none of these solutions work, please file a detailed issue report on GitHub._
