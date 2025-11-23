# Media Cache Implementation

## Overview

This implementation adds media caching with IndexedDB storage for offline viewing and faster load times. The cache automatically manages storage with LRU eviction at a configurable size limit (default 100MB).

## Architecture

### Core Components

1. **MediaStorageDB** (`src/services/media-storage-db.ts`)
   - IndexedDB wrapper for storing media blobs
   - Tracks media metadata (URL, size, MIME type, dimensions, access patterns)
   - Provides indexes for efficient LRU queries
   - Handles cache statistics and queries

2. **MediaCacheService** (`src/services/media-cache-service.ts`)
   - Singleton service for media caching operations
   - Implements LRU eviction strategy
   - Handles automatic cleanup when cache exceeds threshold (90%)
   - Supports batch preloading and individual media fetching

3. **useMediaPreload Hook** (`src/hooks/useMediaPreload.ts`)
   - React hook for automatic media preloading in timelines
   - Configurable lookahead distance and video preloading
   - Tracks preloaded indices to avoid duplicate work

4. **MediaCacheSettings Component** (`src/components/settings/MediaCacheSettings.tsx`)
   - User interface for cache management
   - Displays cache statistics (size, usage, media types)
   - Allows manual cache clearing and size configuration

## Features

### LRU Eviction

- Automatically triggers when cache reaches 90% of max size
- Removes oldest items (by last accessed time) until cache is at 70%
- Maintains metadata for efficient eviction queries

### Media Preloading

- Timeline components can use `useMediaPreload` hook
- Preloads media for next N posts (configurable lookahead)
- Batched loading (5 items at a time) to avoid overwhelming network
- Optionally excludes videos to save bandwidth

### Cache Management UI

Located at `/settings/media-cache`, provides:

- Real-time cache usage statistics
- Visual progress bar with color coding (green/yellow/red)
- Breakdown by media type (images, videos, etc.)
- Per-type cache clearing
- Configurable max cache size
- Clear all cache functionality

## Usage

### Basic Caching

```typescript
import { MediaCacheService } from "../services/media-cache-service";

const mediaCache = MediaCacheService.getInstance();
await mediaCache.init();

// Get or cache a media URL
const blobUrl = await mediaCache.getOrCacheMedia(imageUrl);
if (blobUrl) {
  img.src = blobUrl;
}
```

### Timeline Preloading

```typescript
import { useMediaPreload } from '../hooks/useMediaPreload';

function TimelineComponent({ posts }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Automatically preload next 5 posts
  useMediaPreload(posts, currentIndex, {
    enabled: true,
    lookahead: 5,
    preloadVideos: false, // Don't preload videos by default
  });

  return <div>...</div>;
}
```

### Cache Statistics

```typescript
const stats = await mediaCache.getStats();
console.log(`Cache usage: ${stats.usedPercentage}%`);
console.log(`Total items: ${stats.totalItems}`);
console.log(`Total size: ${formatBytes(stats.totalSize)}`);
```

### Manual Cache Management

```typescript
// Clear entire cache
await mediaCache.clearCache();

// Clear specific media type
const removedCount = await mediaCache.clearCacheByType("image/jpeg");

// Update max size
await mediaCache.setMaxSize(200 * 1024 * 1024); // 200MB
```

## Configuration

### Default Settings

- Max cache size: 100MB
- Cleanup threshold: 90% of max
- Cleanup target: 70% of max
- Preload batch size: 5 items
- Default lookahead: 5 posts

### Customization

Users can customize max cache size via Settings > Media Cache.

## Implementation Details

### IndexedDB Schema

**Media Store:**

- Key: `url` (media URL)
- Indexes:
  - `by_last_accessed` (for LRU eviction)
  - `by_mime_type` (for type-specific queries)
  - `by_size` (for size-based queries)

**Metadata Store:**

- Key: `id` ('main')
- Contains: totalSize, totalItems, maxSize, lastCleanup

### Blob URL Management

- Media is fetched once and stored as Blob in IndexedDB
- Retrieved media is converted to blob URL via `URL.createObjectURL()`
- Callers should revoke URLs when done: `URL.revokeObjectURL(blobUrl)`

### Performance Considerations

1. **Batched Preloading**: Prevents network congestion by loading 5 items at a time
2. **Lazy Initialization**: Cache service initializes on first use
3. **Indexed Queries**: Uses IndexedDB indexes for efficient LRU queries
4. **Automatic Cleanup**: Prevents cache from growing unbounded

## Future Enhancements

Potential improvements:

- Service worker integration for true offline support
- Intelligent preloading based on scroll velocity
- Network-aware caching (disable on slow connections)
- Cache warming on app startup
- Export/import cache for backup
- Per-account cache limits
- Cache compression for images
