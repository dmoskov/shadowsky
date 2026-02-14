# iOS Share Extension

## Overview

The iOS Share Extension allows users to share URLs and text from other apps (Safari, Chrome, Twitter, etc.) directly into Asphodel's compose screen. This enables users to quickly share interesting content they find while browsing.

## How It Works

### Architecture

The share extension consists of three main components:

1. **Native iOS Extension** (`ios/ShareExtension/`)
   - `ShareViewController.swift` - Handles incoming shared content
   - `Info.plist` - Defines what content types the extension accepts
   - `MainInterface.storyboard` - UI storyboard (transparent view)
   - `ShareExtension.entitlements` - App group permissions

2. **Expo Config Plugin** (`plugins/withShareExtension.js`)
   - Automatically adds the share extension target to the Xcode project
   - Configures build settings and dependencies
   - Adds app group entitlements to both main app and extension

3. **Deep Link Handler** (`app/+native-intent.tsx`)
   - Processes `shadowsky://compose?url=...&text=...` deep links
   - Routes to the compose screen with pre-filled content

### User Flow

1. User finds content in Safari or another app
2. User taps the iOS Share button
3. User selects "Share to Asphodel" from the share sheet
4. Extension captures the URL and/or text
5. Extension opens the main app with a deep link
6. Main app opens compose screen with pre-filled content
7. User can edit and post the content

## Implementation Details

### Supported Content Types

The share extension accepts:
- **URLs** (`public.url`) - Web page links
- **Plain Text** (`public.plain-text`) - Selected text

### Deep Link Format

```
shadowsky://compose?url={url}&text={text}
```

Query parameters:
- `url` (optional) - Shared URL
- `text` (optional) - Shared text

### App Groups

The extension uses app groups to share data between the extension and main app:
- Group ID: `group.io.shadowsky.app`
- Used for: Potential future data sharing between extension and main app

### Compose Screen Integration

The compose screen (`src/screens/compose/ComposeScreen.tsx`) accepts new props:
- `sharedUrl?: string` - URL shared from extension
- `sharedText?: string` - Text shared from extension
- `initialText?: string` - Pre-filled text for compose

When these props are provided, the compose screen initializes with:
- If `sharedText` exists, it's used as the initial text
- If `sharedUrl` exists, it's appended to the text (with spacing)
- Format: `{text}\n\n{url}` or just `{url}` if no text

## Building and Testing

### Prerequisites

- Xcode 15+ installed
- iOS development certificate and provisioning profiles
- App Groups capability enabled in Apple Developer Portal

### Build Commands

```bash
cd mobile

# Clean and rebuild iOS project
npx expo prebuild --platform ios --clean

# Run on simulator
npm run ios

# Build for device
eas build --platform ios --profile development
```

### Testing the Extension

1. Build and install the app on a device or simulator
2. Open Safari and navigate to any webpage
3. Tap the Share button in Safari
4. Scroll down and tap "More" (three dots)
5. Enable "Share to Asphodel" toggle
6. Tap "Done"
7. Now tap Share button again
8. Select "Share to Asphodel"
9. App should open with compose screen pre-filled

### Troubleshooting

**Extension doesn't appear in share sheet:**
- Check that the app is installed
- Check that the extension target is properly configured in Xcode
- Try reinstalling the app

**Deep link not working:**
- Check that URL scheme `shadowsky` is registered
- Check that `+native-intent.tsx` handles the compose path
- Check iOS system logs for errors

**Content not pre-filling:**
- Check that `ComposeScreen` receives the props
- Check that the initialization effect runs
- Add debug logging to track the flow

## Configuration

### Extension Display Name

To change the extension's display name in the share sheet, edit:
`ios/ShareExtension/Info.plist` → `CFBundleDisplayName`

### Supported Content Types

To add or remove content types, edit:
`ios/ShareExtension/Info.plist` → `NSExtension` → `NSExtensionAttributes` → `NSExtensionActivationRule`

Current configuration:
- `NSExtensionActivationSupportsText: true` - Accepts plain text
- `NSExtensionActivationSupportsWebURLWithMaxCount: 1` - Accepts 1 URL

### App Group ID

If you need to change the app group ID, update it in:
1. `ios/ShareExtension/ShareExtension.entitlements`
2. `plugins/withShareExtension.js` (groupId constant)
3. Apple Developer Portal app group settings

## Future Enhancements

Potential improvements:
1. **Rich Content Preview** - Show preview of URL in extension
2. **Account Selection** - If multiple accounts, let user choose in extension
3. **Draft Saving** - Save shared content as draft if user dismisses extension
4. **Image Sharing** - Support sharing images directly
5. **Multiple URLs** - Support sharing multiple links at once
6. **Share Extension UI** - Custom UI instead of immediate redirect

## Version History

- **0.7.0** (2024-02-14) - Initial implementation
  - Basic URL and text sharing
  - Deep link to compose screen
  - Transparent extension UI (immediate redirect)
