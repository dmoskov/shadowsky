# Rich Text View Module

Native SwiftUI module for rendering AT Protocol rich text with facets (mentions, hashtags, and links).

## Features

- ✅ SwiftUI-based native rendering
- ✅ AT Protocol facet support (mentions, hashtags, links)
- ✅ Correct UTF-8 byte offset handling (for emoji and multi-byte characters)
- ✅ Tappable mentions, hashtags, and links
- ✅ Styled text matching React Native theme (primary blue #1d9bf0)
- ✅ Multi-line text support

## Installation

This module is included as part of the Asphodel mobile app. It uses Expo Modules API and requires:

- Expo SDK 50+
- iOS 13.0+

## Usage

```typescript
import RichTextView from './modules/rich-text-view';
import { AppBskyRichtextFacet } from '@atproto/api';

function PostContent({ post }) {
  return (
    <RichTextView
      text={post.text}
      facets={post.facets}
      onMentionPress={(event) => {
        const { handle, did } = event.nativeEvent;
        navigation.navigate('Profile', { handle });
      }}
      onHashtagPress={(event) => {
        const { tag } = event.nativeEvent;
        navigation.navigate('Search', { query: `#${tag}` });
      }}
      onLinkPress={(event) => {
        const { uri } = event.nativeEvent;
        Linking.openURL(uri);
      }}
      style={{ fontSize: 16, lineHeight: 24 }}
    />
  );
}
```

## API

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | Yes | The text content to render |
| `facets` | `ATFacet[]` | No | Array of AT Protocol facets |
| `onMentionPress` | `(event) => void` | No | Called when a mention is tapped |
| `onHashtagPress` | `(event) => void` | No | Called when a hashtag is tapped |
| `onLinkPress` | `(event) => void` | No | Called when a link is tapped |
| `style` | `ViewStyle` | No | Standard React Native style props |

### Event Data

**onMentionPress**:
```typescript
{
  nativeEvent: {
    handle: string; // User handle (without @ prefix)
    did: string;    // User DID
  }
}
```

**onHashtagPress**:
```typescript
{
  nativeEvent: {
    tag: string; // Hashtag (without # prefix)
  }
}
```

**onLinkPress**:
```typescript
{
  nativeEvent: {
    uri: string; // Full URL
  }
}
```

## AT Protocol Facets

Facets use **byte offsets** (not character offsets) to specify ranges in the text. This is important for correctly handling emoji and multi-byte UTF-8 characters.

### Facet Structure

```typescript
interface ATFacet {
  index: {
    byteStart: number; // UTF-8 byte offset (inclusive)
    byteEnd: number;   // UTF-8 byte offset (exclusive)
  };
  features: FacetFeature[];
}
```

### Feature Types

**Mention**:
```typescript
{
  $type: 'app.bsky.richtext.facet#mention',
  did: 'did:plc:...'
}
```

**Link**:
```typescript
{
  $type: 'app.bsky.richtext.facet#link',
  uri: 'https://example.com'
}
```

**Hashtag**:
```typescript
{
  $type: 'app.bsky.richtext.facet#tag',
  tag: 'swiftui'
}
```

## Implementation Details

### UTF-8 Byte Offset Handling

The module correctly handles UTF-8 byte offsets, which is critical for:
- Emoji (e.g., 👋 is 4 bytes)
- Multi-byte characters (e.g., é can be 2 bytes)
- Complex emoji with modifiers (e.g., 👨‍💻 is 11 bytes)

The `ByteOffsetConverter` class handles the conversion from byte offsets to Swift `String.Index`.

### Parsing Algorithm

1. Sort facets by byte start position
2. Create segments for plain text and faceted text
3. Handle overlapping facets (uses first feature)
4. Build SwiftUI `Text` views with appropriate styling and tap handlers

### SwiftUI Integration

The module uses `UIHostingController` to embed SwiftUI views in the React Native view hierarchy. This provides:
- Native SwiftUI rendering performance
- Proper text layout and line breaking
- Native iOS text rendering quality

## Testing

The Swift file includes preview examples demonstrating:
- Plain text rendering
- Mentions with DID
- Links with underlining
- Hashtags
- Emoji handling

To view previews in Xcode:
1. Open `ios/Asphodel.xcworkspace`
2. Navigate to `modules/rich-text-view/ios/RichTextView.swift`
3. Open SwiftUI preview (Cmd+Option+Enter)

## Limitations

- iOS only (Android implementation pending)
- First feature used when facet has multiple features
- Text styling is limited to the props passed to the view
- No support for custom link handling UI (context menus, etc.)

## Future Enhancements

- [ ] Android implementation using Jetpack Compose
- [ ] Custom styling props (colors, fonts)
- [ ] Long-press handlers for links
- [ ] Copy text functionality
- [ ] Custom link preview cards
- [ ] Accessibility improvements (VoiceOver support)

## Architecture

```
rich-text-view/
├── ios/
│   ├── RichTextView.swift          # SwiftUI view and parsing logic
│   └── RichTextViewModule.swift    # Expo module bridge
├── src/
│   └── index.ts                    # TypeScript bindings
├── expo-module.config.json         # Expo module configuration
├── package.json                    # Module package definition
└── README.md                       # This file
```

## Related Files

- `mobile/src/utils/rich-text.tsx` - React Native implementation (used as reference)
- AT Protocol RichText spec: https://atproto.com/specs/lexicon#app-bsky-richtext

## Contributing

When modifying this module:
1. Test with various emoji and multi-byte characters
2. Verify byte offset calculations are correct
3. Test on different iOS versions (13.0+)
4. Update TypeScript types if adding new features
5. Rebuild the iOS app after changes (`npm run ios`)

## License

Part of the Asphodel project.
