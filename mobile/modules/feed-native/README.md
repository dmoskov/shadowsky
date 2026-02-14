# Feed Native Module

A local Expo Module that provides native SwiftUI views for feed rendering in the Shadowsky mobile app.

## Overview

This module exposes native iOS views built with SwiftUI that can be used from React Native. It's designed for Expo SDK 54 with the New Architecture enabled.

## Structure

```
feed-native/
├── expo-module.config.json  # Expo module configuration
├── package.json              # Module package definition
├── ios/                      # Native iOS (Swift) code
│   ├── FeedNativeModule.swift   # Main Expo module definition
│   └── FeedNativeView.swift     # SwiftUI view wrapper
└── src/                      # TypeScript/React Native bridge
    ├── index.ts                 # Main export
    ├── FeedNativeView.tsx       # React component wrapper
    └── FeedNativeView.types.ts  # TypeScript types
```

## Usage

Import the component in your React Native code:

```tsx
import { FeedNativeView } from '../../../modules/feed-native';

export default function TestScreen() {
  return (
    <View style={{ flex: 1 }}>
      <FeedNativeView
        message="Custom message"
        style={{ width: '100%', height: 300 }}
      />
    </View>
  );
}
```

## Development

The module is automatically linked by Expo's autolinking system. After making changes:

1. Clean and rebuild: `npx expo run:ios`
2. For Swift changes, you may need to clean the build: `cd ios && rm -rf build && cd ..`

## Platform Support

- **iOS**: ✅ Full support with SwiftUI
- **Android**: ❌ Not implemented yet
- **Web**: ❌ Not applicable

## Requirements

- Expo SDK 54+
- React Native 0.81+
- iOS 14+ (for SwiftUI support)
- New Architecture enabled
