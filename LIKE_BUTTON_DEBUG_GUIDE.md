# Like Button Debug Guide

## Quick Test Steps

1. **Open the app with Chrome Developer Tools**:
   ```bash
   ./scripts/test-like-debug.sh
   ```
   Or manually:
   - Open Chrome
   - Navigate to http://127.0.0.1:5173/
   - Open Developer Tools (Cmd+Option+I)
   - Go to Console tab

2. **Find a post with likes** and click the like button

3. **Check the console for these messages**:
   - `Like button clicked for post: at://...`
   - `Current viewer state: {...}`
   - `Is already liked? true/false`
   - `Post details: {uri: ..., cid: ...}`
   - `Agent session confirmed: <handle>`
   - `Session check passed: <handle> <did>`
   - `Like created successfully: {...}`

## Possible Issues and Solutions

### Issue 1: "Not authenticated - no session on agent"
**Cause**: The agent doesn't have a valid session
**Solution**: 
- Log out and log back in
- Check if session is persisting in localStorage

### Issue 2: No console messages appear
**Cause**: React isn't re-rendering or event handler not attached
**Solution**:
- Hard refresh the page (Cmd+Shift+R)
- Check if the like button has the correct class: `like-btn`

### Issue 3: "Rate limited" error
**Cause**: Too many requests in short time
**Solution**: Wait a minute and try again

### Issue 4: Network error
**Cause**: API request failing
**Solution**: 
- Check Network tab in DevTools
- Look for failed requests to bsky.social

## What to Report

If the like button still doesn't work, please share:
1. All console messages that appear
2. Any errors in the console (red text)
3. Network tab errors (failed requests)
4. Current like count before/after clicking

## Additional Debug Commands

Check if logged in:
```javascript
// In browser console
localStorage.getItem('bsky-session')
```

Check current agent state:
```javascript
// This won't work directly, but errors will be informative
window.__BSKY_AGENT__
```