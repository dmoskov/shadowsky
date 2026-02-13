# Keyboard Shortcuts for iPad

This document describes the keyboard shortcuts available when using the app on iPad with a physical keyboard.

## Available Shortcuts

### Global Shortcuts (Available Everywhere)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `⌘ + N` | New Post | Opens the compose screen to create a new post |
| `⌘ + K` | Search | Opens the search tab |
| `⌘ + 1` | Home Tab | Switches to the Home/Following feed |
| `⌘ + 2` | Search Tab | Switches to the Search tab |
| `⌘ + 3` | Notifications Tab | Switches to the Notifications tab |
| `⌘ + 4` | Profile Tab | Switches to your Profile tab |

### Compose Screen Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `⌘ + Enter` | Submit Post | Posts your content (if valid) |

### Feed Navigation Shortcuts (Home Screen)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` (Arrow Up) | Previous Post | Scrolls to the previous post in the feed |
| `↓` (Arrow Down) | Next Post | Scrolls to the next post in the feed |

## Implementation Details

### Technology Stack

- **Library**: `react-native-keyevent` (v0.3.2)
- **Hook**: `useKeyboardShortcuts` (custom hook in `src/hooks/useKeyboardShortcuts.ts`)
- **Platform**: iOS only (iPad with physical keyboard)

### Architecture

1. **Global Shortcuts**: Registered in the root layout (`app/_layout.tsx`) using `useGlobalKeyboardShortcuts()`
2. **Screen-Specific Shortcuts**: Individual screens can register their own shortcuts by calling `useKeyboardShortcuts()` with custom handlers
3. **Platform Detection**: Shortcuts are only active on iOS to ensure they work on iPad

### Adding New Shortcuts

To add new keyboard shortcuts to a screen:

```typescript
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

function MyScreen() {
  useKeyboardShortcuts({
    onCmdN: () => {
      // Custom handler for cmd+N
    },
    onArrowUp: () => {
      // Custom handler for arrow up
    },
    // ... other shortcuts
  });

  // Rest of component
}
```

### Configuration

The keyboard shortcuts feature requires:
1. `react-native-keyevent` package installed
2. Custom Expo config plugin (`plugins/withKeyEvent.js`)
3. Plugin registered in `app.config.ts`

### Testing

To test keyboard shortcuts:
1. Build the app for iOS using `expo run:ios` or via EAS Build
2. Run on iPad Simulator or physical iPad with keyboard connected
3. Test each shortcut to ensure proper functionality

### Known Limitations

1. **Platform**: Only works on iOS (iPad). Android keyboard support could be added but requires additional native configuration.
2. **Expo Managed Workflow**: Requires expo-dev-client or bare workflow for native module support.
3. **Build Required**: After adding or modifying keyboard shortcuts, a new native build is required (OTA updates won't include native changes).

## Future Enhancements

Potential improvements for keyboard shortcuts:

- [ ] Add keyboard shortcut help overlay (triggered by `⌘ + ?`)
- [ ] Support for `⌘ + L` to like current post
- [ ] Support for `⌘ + R` to repost current post
- [ ] Support for `⌘ + T` to reply to current post
- [ ] Customizable keyboard shortcuts via settings
- [ ] Visual feedback when shortcuts are triggered
- [ ] Android support via similar native module integration
