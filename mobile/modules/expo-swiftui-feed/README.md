# Expo SwiftUI Feed Module

SwiftUI-based feed embed components for the BSKY mobile app. This module provides native iOS implementations of all post embed types that appear within feed items.

## Overview

This Expo module implements SwiftUI versions of all post embed types following the AT Protocol specification:

- **ImageEmbed** - 1-4 image grid layouts with ALT badges and blur support
- **VideoEmbed** - Video player with thumbnail, play button overlay, and native controls
- **ExternalLinkEmbed** - Link preview cards with thumbnail, domain, title, and description
- **QuoteEmbed** - Embedded quoted posts with avatar, author info, and truncated text
- **PostEmbed** - Smart dispatcher that routes to the correct embed type based on AT Protocol type guards

## Features

### ImageEmbed
- **Grid Layouts**: Supports 1-4 images with optimized layouts
  - Single: 300h full width
  - Double: 200h side-by-side
  - Triple: 240h large + 118h small stacked
  - Quad: 150h 2x2 grid
- **ALT Badges**: Shows "ALT" badge when alt text is available
- **Blur Support**: Optional image blurring with opacity adjustment
- **Tap to Expand**: Opens full carousel view (optional handler)

### VideoEmbed
- **Thumbnail Preview**: Shows video thumbnail before playback
- **Play Button Overlay**: Large, centered play button with loading state
- **Native Player**: Uses AVPlayer with native controls
- **Play/Pause Toggle**: Tap to play/pause during playback
- **Auto-restart**: Returns to thumbnail when video finishes

### ExternalLinkEmbed
- **Link Card Layout**: Thumbnail, domain, title, and description
- **Domain Extraction**: Automatically extracts and displays domain from URL
- **Smart Fallbacks**: Handles missing thumbnails and descriptions gracefully
- **Tap to Open**: Opens link in browser (optional handler)

### QuoteEmbed
- **Author Header**: Avatar, display name, and handle
- **Truncated Text**: Post text limited to 3 lines
- **Not Found State**: Shows "[Post not found]" for deleted/blocked posts
- **Tap to Navigate**: Opens quoted post (optional handler)

### PostEmbed Dispatcher
- **Type Detection**: Automatically routes based on AT Protocol `$type` field
- **RecordWithMedia**: Renders both media and quote for combined embeds
- **Type Guards**: Mirrors React Native type checking logic
- **Event Handlers**: Supports custom handlers for all embed types

## Installation

This module is designed to be used within the BSKY mobile app's Expo environment.

1. The module is located at `mobile/modules/expo-swiftui-feed/`
2. It's automatically discovered by Expo's autolinking
3. No additional installation steps required

## Architecture

```
expo-swiftui-feed/
├── ios/
│   └── Sources/
│       └── ExpoSwiftUIFeed/
│           ├── ExpoSwiftUIFeedModule.swift  # Module definition
│           ├── ImageEmbed.swift              # Image grid layouts
│           ├── VideoEmbed.swift              # Video player
│           ├── ExternalLinkEmbed.swift       # Link cards
│           ├── QuoteEmbed.swift              # Quoted posts
│           └── PostEmbed.swift               # Dispatcher & type conversion
├── src/
│   └── ExpoSwiftUIFeedModule.ts             # TypeScript bridge interface
├── expo-module.config.json                   # Expo module configuration
├── package.json                              # Module metadata
└── README.md                                 # This file
```

## Usage

### TypeScript Integration

```typescript
import { convertATProtoEmbedToSwiftUI } from 'expo-swiftui-feed';
import type { PostEmbedData } from 'expo-swiftui-feed';

// Convert AT Protocol embed data to SwiftUI format
const swiftUIEmbed = convertATProtoEmbedToSwiftUI(atProtoEmbed);
```

### React Native Integration

The SwiftUI views are designed to be integrated into React Native screens. The TypeScript bridge provides type-safe conversion from AT Protocol data structures.

```typescript
import { PostEmbed } from './components/PostEmbed';
import { convertATProtoEmbedToSwiftUI } from 'expo-swiftui-feed';

function FeedItem({ post }) {
  const swiftUIEmbed = convertATProtoEmbedToSwiftUI(post.embed);

  return (
    <PostEmbed
      embed={post.embed}
      onImagePress={(images, index) => openCarousel(images, index)}
      onLinkPress={(url) => openBrowser(url)}
      onQuotePress={(uri, handle) => navigateToPost(uri)}
      blurImages={post.isContentFiltered}
    />
  );
}
```

## AT Protocol Integration

The module implements type guards matching the AT Protocol specification:

- `app.bsky.embed.images#view` → ImageEmbed
- `app.bsky.embed.video#view` → VideoEmbed
- `app.bsky.embed.external#view` → ExternalLinkEmbed
- `app.bsky.embed.record#view` → QuoteEmbed
- `app.bsky.embed.recordWithMedia#view` → Combined media + quote

## Layout Specifications

### Image Grid Layouts

**Single Image** (imageCount === 1)
```
┌─────────────────────┐
│                     │
│                     │
│   Single (300h)     │
│                     │
│                     │
└─────────────────────┘
```

**Double Images** (imageCount === 2)
```
┌──────────┬──────────┐
│          │          │
│  Image   │  Image   │
│  (200h)  │  (200h)  │
│          │          │
└──────────┴──────────┘
```

**Triple Images** (imageCount === 3)
```
┌──────────────┬──────┐
│              │  Img │
│              │ (118)│
│   Large      ├──────┤
│   (240h)     │  Img │
│              │ (118)│
└──────────────┴──────┘
```

**Quad Images** (imageCount === 4)
```
┌──────────┬──────────┐
│  Image   │  Image   │
│  (150h)  │  (150h)  │
├──────────┼──────────┤
│  Image   │  Image   │
│  (150h)  │  (150h)  │
└──────────┴──────────┘
```

## Event Handlers

All embed types support optional event handlers:

```typescript
// Image press handler
onImagePress?: (images: ImageEmbedData[], index: number) => void

// Link press handler (videos and external links)
onLinkPress?: (url: string) => void

// Quote press handler
onQuotePress?: (uri: string, handle: string) => void

// Blur images flag
blurImages?: boolean
```

## Data Models

### ImageEmbedData
```typescript
{
  thumb: string;           // Thumbnail URL
  fullsize: string;        // Full-size image URL
  alt?: string;            // Alt text (shows ALT badge if present)
  aspectRatio?: number;    // Image aspect ratio
}
```

### VideoEmbedData
```typescript
{
  playlist: string;        // Video HLS playlist URL
  thumbnail?: string;      // Thumbnail image URL
  alt?: string;            // Alt text description
  aspectRatio?: number;    // Video aspect ratio
}
```

### ExternalLinkEmbedData
```typescript
{
  uri: string;             // Link URL
  title?: string;          // Link title
  description?: string;    // Link description
  thumb?: string;          // Thumbnail image URL
}
```

### QuoteEmbedData
```typescript
{
  uri: string;             // Post URI
  author: {
    handle: string;        // Author handle
    displayName?: string;  // Display name
    avatar?: string;       // Avatar URL
  };
  text?: string;           // Post text (truncated to 3 lines)
  createdAt?: string;      // Creation timestamp
}
```

## Development

### Preview in Xcode

Each SwiftUI view includes preview providers for development:

```swift
#if DEBUG
struct ImageEmbed_Previews: PreviewProvider {
    static var previews: some View {
        ImageEmbed(images: [...])
    }
}
#endif
```

### Testing

The module includes sample data for all embed types in the preview providers. Use Xcode's canvas to preview and test each component.

## Requirements

- iOS 14.0+
- Expo SDK 48+
- SwiftUI
- AVKit (for video playback)

## Dependencies

This module depends on:
- **ExpoModulesCore** - Expo's native module infrastructure
- **SwiftUI** - Apple's declarative UI framework
- **AVKit** - Apple's video playback framework

## Comparison with React Native Components

| Component | React Native | SwiftUI | Notes |
|-----------|--------------|---------|-------|
| **ImageEmbed** | ~176 lines | ~240 lines | SwiftUI adds type-safe layout logic |
| **VideoEmbed** | ~172 lines | ~180 lines | Native AVPlayer integration |
| **ExternalLinkEmbed** | ~101 lines | ~140 lines | Similar layout, native AsyncImage |
| **QuoteEmbed** | ~111 lines | ~150 lines | Type-safe author rendering |
| **PostEmbed** | ~63 lines | ~240 lines | Includes AT Proto parsing logic |

The SwiftUI implementations maintain feature parity with React Native while providing:
- Native performance
- SwiftUI's declarative syntax
- Type safety
- Native iOS feel

## License

MIT

## Author

BSKY Team
