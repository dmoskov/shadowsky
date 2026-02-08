# Manual Commit Instructions for Task 1213045707899353

## Changes Made

Modified `src/components/VideoPlayer.tsx` to add proper cleanup for HLS.js event listeners.

### What Was Fixed

Previously, 2 out of 10 event listeners were missing proper cleanup:
- `hls.on(Hls.Events.MANIFEST_PARSED, ...)` - Line 300 (now 352)
- `hls.on(Hls.Events.ERROR, ...)` - Line 310 (now 353)

### Changes Applied

1. **Extracted anonymous handlers into named functions** (lines 300-350):
   - Created `handleManifestParsed` function
   - Created `handleHlsError` function

2. **Added cleanup in useEffect return** (lines 385-389):
   ```typescript
   if (hlsInstance) {
     hlsInstance.off(Hls.Events.MANIFEST_PARSED);
     hlsInstance.off(Hls.Events.ERROR);
     hlsInstance.destroy();
   }
   ```

## All 10 Event Listeners Now Have Cleanup ✅

1. ✅ `document.addEventListener("fullscreenchange")` - cleanup at line 176
2. ✅ `video.addEventListener("timeupdate")` - cleanup at line 526
3. ✅ `video.addEventListener("loadstart")` - cleanup at line 527
4. ✅ `video.addEventListener("loadedmetadata")` - cleanup at line 528
5. ✅ `video.addEventListener("waiting")` - cleanup at line 529
6. ✅ `video.addEventListener("canplay")` - cleanup at line 530
7. ✅ `video.addEventListener("stalled")` - cleanup at line 531
8. ✅ `document.addEventListener("keydown")` - cleanup at line 598
9. ✅ `hls.on(Hls.Events.MANIFEST_PARSED)` - cleanup at line 386 (NEWLY FIXED)
10. ✅ `hls.on(Hls.Events.ERROR)` - cleanup at line 387 (NEWLY FIXED)

## Git Commands to Execute

```bash
cd /workspace/shadowsky

# Add the file
git add src/components/VideoPlayer.tsx

# Commit with proper message
git commit -m "[1213045707899353] fix: Add cleanup for HLS.js event listeners in VideoPlayer

- Extracted HLS event handlers (MANIFEST_PARSED, ERROR) into named functions
- Added explicit .off() calls to remove HLS event listeners before destroying instance
- Ensures no memory leaks when component unmounts or video source changes

All 10 event listeners now have proper cleanup:
- 8 DOM addEventListener calls with removeEventListener
- 2 HLS.js .on() calls with .off() (newly fixed)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote
git push origin task/1213045707899353

# Get commit SHA
git rev-parse HEAD
```

## Verification

After committing, verify:
- No memory leaks when VideoPlayer component unmounts
- Video playback still works correctly
- HLS streams load and play properly
- All event listeners are properly cleaned up
