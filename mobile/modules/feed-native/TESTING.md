# Testing Guide for Feed Native Module

## Prerequisites

- macOS with Xcode 15+
- iOS Simulator or physical iOS device
- Expo CLI installed
- Node.js and npm

## Build and Test Steps

### 1. Clean Build

Before testing the module for the first time:

```bash
cd mobile
rm -rf node_modules ios/build
npm install
```

### 2. Prebuild iOS Project

Generate the native iOS project with Expo modules:

```bash
npx expo prebuild --platform ios --clean
```

This will:
- Generate the Xcode project with all Expo modules
- Auto-link the feed-native local module
- Configure the build settings

### 3. Build and Run

Run the app in iOS simulator:

```bash
npx expo run:ios
```

Or specify a device:

```bash
npx expo run:ios --device
```

### 4. Navigate to Test Screen

Once the app is running:

1. Open the app
2. Navigate to Settings
3. Look for "Feed Native Test" option (or navigate directly via deep link)
4. You should see three SwiftUI views with different messages

### 5. Verify Module is Loaded

Check the Xcode console for any module loading errors. You should see:

```
✓ FeedNativeModule loaded successfully
```

### 6. Expected Behavior

The test screen should display:

- Three native SwiftUI views embedded in React Native
- Each view has a blue/purple gradient background
- Swift and iPhone icons are visible
- Custom messages are displayed
- Smooth rendering without flickering

## Troubleshooting

### Module Not Found

If you see "FeedNative module not found":

1. Clean the build: `cd ios && rm -rf build && cd ..`
2. Run prebuild again: `npx expo prebuild --platform ios --clean`
3. Rebuild: `npx expo run:ios`

### Swift Compilation Errors

If Swift files fail to compile:

1. Check Xcode version (must be 15+)
2. Verify iOS deployment target is 14.0+ in Xcode
3. Clean the build folder in Xcode: Product > Clean Build Folder

### View Not Rendering

If the view appears blank:

1. Check that ExpoModulesCore is properly linked
2. Verify the view has a non-zero height (check styles)
3. Look for errors in Xcode console

## Manual Testing Checklist

- [ ] App builds successfully with `npx expo run:ios`
- [ ] No module loading errors in console
- [ ] Test screen accessible via Settings or direct navigation
- [ ] SwiftUI views render correctly
- [ ] Different messages display in each view
- [ ] No memory leaks (monitor in Xcode Instruments)
- [ ] View updates when props change (if implemented)
- [ ] No crashes when navigating away and back

## Performance Testing

1. Open Xcode Instruments (Cmd+I in Xcode)
2. Select "Time Profiler" or "Leaks"
3. Navigate to the test screen multiple times
4. Verify no memory leaks or performance issues

## Next Steps

Once the basic module is verified:

1. Implement actual feed rendering logic
2. Add data fetching and state management
3. Implement scroll performance optimizations
4. Add pull-to-refresh functionality
5. Integrate with app's theme system
