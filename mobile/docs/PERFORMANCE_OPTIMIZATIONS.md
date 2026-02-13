# FlatList Performance Optimizations

## Summary
This document outlines the virtual scrolling optimizations implemented for React Native feeds to improve performance with large datasets containing images and videos.

## Changes Made

### 1. FeedList Component (`mobile/src/components/FeedList.tsx`)
**Issue**: Key extractor was using index, creating unstable keys; missing batch update optimization.

**Optimizations Applied**:
- ✅ Fixed `keyExtractor` to use only `item.post.uri` (removed index)
- ✅ Tuned `windowSize` from 10 to 7 (reduces memory footprint)
- ✅ Added `updateCellsBatchingPeriod={50}` for smoother scrolling
- ✅ Already had: `removeClippedSubviews`, `maxToRenderPerBatch`, `initialNumToRender`

**Note**: `getItemLayout` not implemented due to variable post heights (text length, images, videos vary).

### 2. FeedDiscoveryScreen (`mobile/src/screens/feeds/FeedDiscoveryScreen.tsx`)
**Issue**: No performance optimizations applied to feed discovery list.

**Optimizations Applied**:
- ✅ Added `removeClippedSubviews={true}`
- ✅ Added `maxToRenderPerBatch={8}`
- ✅ Added `windowSize={5}` (smaller for card-based list)
- ✅ Added `initialNumToRender={8}`
- ✅ Added `updateCellsBatchingPeriod={50}`
- ✅ Implemented `getItemLayout` with fixed height estimation (160px item + 12px margin = 172px)

**Impact**: Fixed-height feed cards allow efficient scroll position calculation.

### 3. TimelineScreen (`mobile/src/screens/home/TimelineScreen.tsx`)
**Issue**: Media grid with no performance optimizations despite fixed item sizes.

**Optimizations Applied**:
- ✅ Added `removeClippedSubviews={true}`
- ✅ Added `maxToRenderPerBatch={15}` (3 columns × 5 rows)
- ✅ Added `windowSize={7}` (balanced for grid layout)
- ✅ Added `initialNumToRender={15}` (3 columns × 5 rows)
- ✅ Added `updateCellsBatchingPeriod={50}`
- ✅ Implemented `getItemLayout` using ITEM_SIZE and GRID_SPACING constants

**Impact**: Grid layout with fixed sizes is ideal case for `getItemLayout` optimization.

### 4. DraftsScreen (`mobile/src/screens/compose/DraftsScreen.tsx`)
**Issue**: Basic FlatList with no performance optimizations.

**Optimizations Applied**:
- ✅ Added `removeClippedSubviews={true}`
- ✅ Added `maxToRenderPerBatch={10}`
- ✅ Added `windowSize={5}`
- ✅ Added `initialNumToRender={10}`
- ✅ Added `updateCellsBatchingPeriod={50}`

## Performance Props Explained

### `removeClippedSubviews={true}`
- Unmounts views outside the visible window
- Reduces memory usage and improves scroll performance
- Essential for large lists with media

### `windowSize={N}`
- Number of screen heights to render above/below viewport
- Lower values = less memory, but risk blank space during fast scrolling
- Values used: 5 (simple lists), 7 (complex lists/grids)

### `maxToRenderPerBatch={N}`
- Maximum items rendered per batch during scroll
- Balances render time vs blank space
- Values used: 8-10 (simple items), 15 (grid with 3 columns)

### `initialNumToRender={N}`
- Items rendered on initial mount
- Should cover ~1.5 screens of content
- Matches `maxToRenderPerBatch` for consistency

### `updateCellsBatchingPeriod={50}`
- Delay (ms) between batch renders during scroll
- 50ms provides smooth scrolling without lag
- Reduces main thread pressure

### `getItemLayout`
- Tells FlatList item dimensions upfront
- Enables instant scroll-to-position without measuring
- Only usable with fixed-height items
- Format: `(data, index) => ({length, offset, index})`

## FlashList Migration Recommendation

### What is FlashList?
[@shopify/flash-list](https://shopify.github.io/flash-list/) is a drop-in replacement for FlatList with significantly better performance:
- 10x better recycling mechanism
- Reduces blank space during scroll
- Lower memory footprint
- Better handling of variable-height items

### Current Status
- ❌ **NOT installed** in `mobile/package.json`
- Would require: `npm install @shopify/flash-list`

### Migration Candidates

#### High Priority: FeedList Component
**Why**: Variable-height posts with images/videos benefit most from FlashList's recycling.

**Effort**: Low
```tsx
import { FlashList } from "@shopify/flash-list";

// Replace FlatList with FlashList
<FlashList
  data={filteredPosts}
  renderItem={renderItem}
  estimatedItemSize={200} // average post height
  // ... other props remain the same
/>
```

#### Medium Priority: DraftsScreen
**Why**: Variable content length (text preview, metadata, warnings).

**Effort**: Low
```tsx
estimatedItemSize={120} // average draft card height
```

#### Low Priority: FeedDiscoveryScreen & TimelineScreen
**Why**: Already have `getItemLayout` with fixed heights. FlashList benefits are minimal.

**Effort**: Low, but not recommended (current optimizations are sufficient).

### Installation Steps
```bash
cd mobile
npm install @shopify/flash-list
```

Then update imports in target components:
```tsx
// Before
import { FlatList } from 'react-native';

// After
import { FlashList } from '@shopify/flash-list';
```

### Estimated Performance Gains
- **FeedList**: 40-60% reduction in blank space during fast scrolling
- **DraftsScreen**: 30-40% improvement in scroll smoothness
- **Memory**: 20-30% reduction in overall memory usage for feed rendering

### Migration Risk Assessment
- **Risk Level**: Low
- **Breaking Changes**: None (drop-in replacement)
- **Testing Required**:
  - Scroll performance (fast scroll, fling)
  - Pull-to-refresh behavior
  - Infinite scroll (onEndReached)
  - Item interactions (press, long press)

## Testing Recommendations

### Performance Profiling Tools
1. **React DevTools Profiler**
   - Measure render times before/after
   - Identify unnecessary re-renders

2. **Flipper (React Native Debugger)**
   - Memory usage monitoring
   - FPS metrics during scroll
   - Network waterfall for images

3. **Hermes Profiler**
   - JavaScript execution time
   - Garbage collection pressure

### Test Scenarios
1. **Large Feed Scroll** (100+ posts with images)
   - Smooth scroll from top to bottom
   - Fast fling gesture
   - Measure: FPS, blank space occurrences

2. **Media Grid Scroll** (50+ images)
   - Smooth vertical scroll
   - Measure: Memory usage, image load performance

3. **Memory Leak Test**
   - Scroll extensively for 2-3 minutes
   - Check memory doesn't grow unbounded
   - Profile with Flipper or Xcode Instruments

### Expected Improvements
- **Before**: Occasional blank space during fast scroll, higher memory usage
- **After**: Minimal blank space, 20-30% less memory, smoother 60fps scrolling

## Future Optimizations

### 1. Image Optimization
- Implement progressive loading with blur-up placeholder
- Use lower resolution thumbnails for feed images
- Consider `react-native-fast-image` for better image caching

### 2. Memoization
- Use `React.memo()` on PostCard, MediaGridItem components
- Optimize expensive computations with `useMemo()`
- Reduce prop drilling to minimize re-renders

### 3. Virtualization Enhancements
- Implement skeleton screens during initial load
- Progressive enhancement: load text first, images later
- Consider pagination batch size tuning (currently 25-50 posts per page)

### 4. Native Driver Animations
- Ensure scroll animations use native driver
- Offload animations from JavaScript thread

## References
- [React Native FlatList Performance](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Shopify FlashList](https://shopify.github.io/flash-list/)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Flipper Debugging](https://fbflipper.com/)
