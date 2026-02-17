# On-Device Xcode Instruments Validation Plan

**Date**: 2026-02-17
**Task**: [P1] Run on-device Xcode Instruments validation (sustained load test)
**Prerequisites**: Physical iOS device, Xcode 16+, Release build of Asphodel

---

## Context

This plan validates four critical performance fixes identified in the static profiling analysis
(`INSTRUMENTS_PROFILING_REPORT.md`):

| Fix | Issue | What Changed |
|-----|-------|--------------|
| P0 | ISSUE-JS-1/CPU-2/MEM-1 | `visiblePostUris` changed from `useState` to `useRef` in `FeedList.tsx:86` |
| P1 | ISSUE-CPU-1 | Muted word regexes pre-compiled and cached in `content-filter.ts:44-76` |
| P2 | ISSUE-MEM-3 | SDWebImage memory cache capped at 100MB/256 images in `CachedAsyncImage.swift:18-23` |
| P6 | ISSUE-MEM-4 | Incremental updates consolidated to single struct copy in `FeedBridgeModule.swift:57-72` |

---

## Setup

### 1. Build Configuration

Build a **Release** configuration to profile realistic performance:

```bash
# From mobile/ directory
npx expo run:ios --configuration Release --device
```

Or via Xcode:
1. Open `mobile/ios/Asphodel.xcworkspace`
2. Select physical device target
3. Edit Scheme → Run → Build Configuration → **Release**
4. Product → Profile (⌘I) to launch Instruments

### 2. Device Preparation

- Close all other apps (minimize background activity)
- Disable Low Power Mode
- Charge to >50% (thermal throttling at low battery)
- Disable Do Not Disturb (to test notification polling)
- Connect via USB (not wireless debugging)

### 3. Account Preparation

- Log in with an account that follows 50+ accounts (ensures rich feed)
- Have 5-10 muted words configured (exercises regex cache)
- Enable video autoplay in settings

---

## Test 1: Sustained Feed Scroll (5 minutes)

### Objective
Verify memory plateaus and JS thread stays responsive during continuous scrolling.

### Instruments Template
**Allocations + Time Profiler + Core Animation** (custom combination)

Or use the automation script:
```bash
./mobile/scripts/instruments-validate.sh test1-sustained-scroll
```

### Steps

1. Launch app, navigate to Home feed
2. Wait for initial feed to fully load (all images visible)
3. Start Instruments recording
4. Scroll continuously downward at moderate pace (~2 posts/sec) for 5 minutes
5. Stop recording

### Pass Criteria

| Metric | Target | Fail Threshold | Measurement |
|--------|--------|----------------|-------------|
| Memory plateau | ≤150 MB | >200 MB | Allocations → All Heap & Anonymous VM → Persistent Bytes |
| Memory growth rate | <1 MB/min after minute 2 | >5 MB/min | Linear trend of Persistent Bytes over time |
| JS thread utilization | <60% | >80% | Time Profiler → Thread filter: "com.facebook.react.JavaScript" |
| Frame rate | >55 fps | <45 fps | Core Animation → FPS gauge |
| GC pauses | <10ms each | >50ms | Time Profiler → search "GC" in call tree |

### What to Look For

**P0 fix validation (visiblePostUris ref)**:
- In Time Profiler, search for `FeedList` in the call tree
- Should NOT see continuous `FeedList.render` calls during scroll
- `onViewableItemsChanged` should appear but NOT trigger React re-renders
- If you see `React.setState` called from scroll handler → P0 fix has regressed

**P1 fix validation (regex cache)**:
- In Time Profiler, filter to JS thread
- Search for `RegExp` or `compile` in call tree
- Should see regex compilation only on first load-more, not subsequent ones
- Total RegExp time should be <5ms across the full 5 minutes

**P2 fix validation (SDWebImage cache)**:
- In Allocations, filter by `UIImage` or `CG raster data`
- Image memory should plateau at ~80-100MB (the configured cap)
- Should NOT grow linearly without bound

### Recording the Results

After the test, take a screenshot of:
1. Allocations → Persistent Bytes graph (should show plateau)
2. Time Profiler → Heaviest Stack Trace (should NOT be FeedList.render)
3. Core Animation → FPS graph (should be consistently >55 fps)

---

## Test 2: Rapid Load-More Pagination

### Objective
Verify no main-thread blocks during rapid pagination events.

### Instruments Template
**Time Profiler + Thread States**

Or use the automation script:
```bash
./mobile/scripts/instruments-validate.sh test2-rapid-loadmore
```

### Steps

1. Start from Home feed with loaded content
2. Start Instruments recording
3. Scroll rapidly to bottom to trigger load-more
4. As soon as new content appears, immediately scroll to bottom again
5. Repeat 5+ times in quick succession (trigger 5+ load-more events in ~30 seconds)
6. Stop recording

### Pass Criteria

| Metric | Target | Fail Threshold | Measurement |
|--------|--------|----------------|-------------|
| Main thread block | <16ms per event | >33ms (2 dropped frames) | Time Profiler → Main Thread → Heaviest Stack Trace |
| JSON decode time | <50ms per page | >100ms | Time Profiler → search "JSONDecoder" |
| NSLock contention | <5ms wait | >16ms | Thread States → "Blocked" on main thread |

### What to Look For

**P6 fix validation (consolidated struct copies)**:
- In Time Profiler, search for `SerializedPost.init`
- Should see 1 init call per updated post, NOT 3
- Total time in SerializedPost creation should be <10ms per batch update

**NSLock contention (ISSUE-CPU-3)**:
- In Thread States, check main thread for "Blocked" periods during load-more
- If main thread blocks >16ms waiting on `feedDataLock` → lock contention issue
- Bridge thread holding lock during JSON decode should be <15ms

---

## Test 3: Memory Pressure Test

### Objective
Verify memory drops on background and no OOM termination.

### Instruments Template
**Allocations + VM Tracker + Activity Monitor**

Or use the automation script:
```bash
./mobile/scripts/instruments-validate.sh test3-memory-pressure
```

### Steps

1. Start Instruments recording
2. Load Home feed
3. Scroll through 10 pages of content (~500 posts)
4. Note peak memory (should be ≤150MB from Test 1 criteria)
5. Press Home button to background the app
6. Wait 10 seconds
7. Open a memory-intensive app (Camera, Maps) to trigger memory pressure
8. Return to Asphodel
9. Stop recording

### Pass Criteria

| Metric | Target | Fail Threshold | Measurement |
|--------|--------|----------------|-------------|
| Memory drop on background | >30% reduction | <10% reduction | Allocations → Compare persistent bytes before/after background |
| CG raster data on background | Should decrease | Stays constant | VM Tracker → filter "CG raster data" |
| Post-pressure memory | <120 MB | >180 MB | Allocations after returning to foreground |
| App survival | No OOM crash | OOM termination | App still running after memory pressure |

### What to Look For

**P2 fix validation (SDWebImage cache cleanup)**:
- SDWebImage uses `NSCache` which should release on memory pressure
- Additionally, the 100MB cap prevents runaway growth before pressure arrives
- In VM Tracker, `CG raster data` should show a clear drop on background
- If `CG raster data` stays flat → SDWebImage cache not responding to pressure

**Image cache behavior**:
- Check `SDImageCache` in Allocations for dealloc events on background
- Memory cache should clear; disk cache should persist

---

## Test 4: Background Timer Audit

### Objective
Verify no timer callbacks block the main thread during scroll.

### Instruments Template
**System Trace + Network Activity**

Or use the automation script:
```bash
./mobile/scripts/instruments-validate.sh test4-timer-audit
```

### Steps

1. Start Instruments recording with System Trace
2. Load Home feed
3. Scroll continuously for 2 minutes
4. Monitor for concurrent timer activations:
   - Session refresh (50min interval) — unlikely to fire
   - Session validity check (5min interval) — may fire once
   - Notification polling (30sec interval) — should fire 4 times
   - Mutation queue processing (30sec interval) — should fire 4 times
5. Stop recording

### Pass Criteria

| Metric | Target | Fail Threshold | Measurement |
|--------|--------|----------------|-------------|
| Timer main-thread blocks | <5ms each | >16ms | System Trace → Main Thread → Timer callbacks |
| Notification poll during scroll | Uses adaptive polling | Fires every 30s regardless | Network Activity → count notification requests |
| Total timer overhead | <2% of main thread | >5% | System Trace → Summary |

### What to Look For

**Adaptive polling validation**:
- Notification polling should use 30s interval when NOT on Jetstream
- When Jetstream is connected, should use 120s interval
- Network Activity should show notification requests at the correct interval
- Should NOT fire in background (verify `refetchIntervalInBackground: false`)

**Timer coalescing**:
- System Trace should show timer callbacks dispatched to background queues
- Main thread should not be blocked by timer handlers
- If `setInterval` or `setTimeout` callbacks appear on main thread during scroll → issue

---

## Automated Performance Tests

### XCTest Performance Benchmarks

The project includes XCTest performance tests that can be run from Xcode:

```bash
# Run from mobile/ directory on a Mac with Xcode
xcodebuild test \
  -workspace ios/Asphodel.xcworkspace \
  -scheme Asphodel \
  -destination 'platform=iOS,name=<YOUR_DEVICE_NAME>' \
  -only-testing:AsphodelPerformanceTests
```

These tests validate:
- Feed data decoding performance (50, 200, 500 posts)
- Incremental update batch processing
- Post conversion throughput
- SDWebImage cache configuration
- Memory behavior under simulated load

### JavaScript Performance Tests

```bash
# Run Jest performance benchmarks
cd mobile
npm test -- --testPathPattern=performance
```

---

## Results Template

Copy this section and fill in after running each test:

```
## Validation Results — [DATE]

### Device: [Model, iOS version]
### Build: [Release/Debug, version]

### Test 1: Sustained Feed Scroll
- Memory plateau: _____ MB (target: ≤150 MB)  [PASS/FAIL]
- Memory growth rate: _____ MB/min (target: <1 MB/min)  [PASS/FAIL]
- JS thread utilization: ____% (target: <60%)  [PASS/FAIL]
- Frame rate: _____ fps (target: >55 fps)  [PASS/FAIL]
- Screenshot: [attached]

### Test 2: Rapid Load-More
- Max main thread block: _____ ms (target: <16ms)  [PASS/FAIL]
- JSON decode time: _____ ms/page (target: <50ms)  [PASS/FAIL]
- NSLock contention: _____ ms (target: <5ms)  [PASS/FAIL]

### Test 3: Memory Pressure
- Memory drop on background: ____% (target: >30%)  [PASS/FAIL]
- CG raster data decrease: [YES/NO]  [PASS/FAIL]
- Post-pressure memory: _____ MB (target: <120 MB)  [PASS/FAIL]
- App survived: [YES/NO]  [PASS/FAIL]

### Test 4: Timer Audit
- Timer main-thread blocks: _____ ms max (target: <5ms)  [PASS/FAIL]
- Notification poll interval: _____ sec (target: 30s or 120s w/ Jetstream)  [PASS/FAIL]
- Timer overhead: ____% (target: <2%)  [PASS/FAIL]

### Overall: [PASS/FAIL]
### Notes: [Any observations, regressions, or unexpected findings]
```

---

## Appendix: Quick Reference

### Instruments Keyboard Shortcuts
- **⌘R**: Start/Stop recording
- **⌘E**: Export trace
- **⌘F**: Find in call tree
- **⌥Click**: Expand entire call tree branch

### Useful Instruments Filters
- Memory: `Allocations > Statistics > All Heap & Anonymous VM`
- JS Thread: `Time Profiler > Thread: com.facebook.react.JavaScript`
- Main Thread: `Time Profiler > Thread: Main Thread`
- Images: `VM Tracker > Type: CG raster data`
- Network: `Network > Host: bsky.social`

### xctrace CLI Reference
```bash
# Record a trace with Time Profiler
xctrace record --device <UDID> --template 'Time Profiler' --attach <PID> --time-limit 5m

# Export trace to XML for analysis
xctrace export --input recording.trace --xpath '/trace-toc/run/data/table'
```
