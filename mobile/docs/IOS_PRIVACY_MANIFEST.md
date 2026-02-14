# iOS Privacy Manifest Implementation

## Overview

This document describes the implementation of the iOS Privacy Manifest (PrivacyInfo.xcprivacy) required for App Store submission on iOS 17+.

## What is a Privacy Manifest?

A Privacy Manifest is a property list file (`PrivacyInfo.xcprivacy`) that declares:
1. The types of data your app collects
2. The required reason APIs your app uses

Starting May 1, 2024, Apple requires all apps to include privacy manifests that document their use of certain APIs.

## Implementation

### Files Created

1. **`ios/PrivacyInfo.xcprivacy`** - The privacy manifest file itself
2. **`plugins/withPrivacyManifest.js`** - Expo config plugin to integrate the manifest
3. **`app.config.ts`** - Updated to include the privacy manifest plugin

### Required Reason APIs Declared

Our app declares the following Required Reason APIs:

#### 1. NSPrivacyAccessedAPICategoryUserDefaults
- **Reason Code**: CA92.1
- **Purpose**: Reading and writing app-specific configuration and state information
- **Used By**: @react-native-async-storage/async-storage for persistent key-value storage

#### 2. NSPrivacyAccessedAPICategoryFileTimestamp
- **Reason Code**: C617.1
- **Purpose**: Accessing file metadata without user tracking
- **Used By**: File system operations (expo-file-system, cache management)

#### 3. NSPrivacyAccessedAPICategoryDiskSpace
- **Reason Code**: E174.1
- **Purpose**: Checking available storage space
- **Used By**: Cache size calculations, media download management

#### 4. NSPrivacyAccessedAPICategorySystemBootTime
- **Reason Code**: 35F9.1
- **Purpose**: Performance optimization and analytics
- **Used By**: Background task scheduling, app lifecycle tracking

## How It Works

1. The `PrivacyInfo.xcprivacy` file is placed in the `ios/` directory
2. The `withPrivacyManifest` config plugin runs during the Expo prebuild process
3. The plugin adds the privacy manifest file as a resource to the Xcode project
4. When the app is built, the privacy manifest is included in the bundle

## Reason Code Reference

### UserDefaults Reason Codes
- **CA92.1**: Accessing user defaults from an app or app extension

### FileTimestamp Reason Codes
- **C617.1**: File timestamps for general file management
- **3B52.1**: File timestamps for displaying to user
- **0A2A.1**: File timestamps for specific file attributes

### DiskSpace Reason Codes
- **E174.1**: Checking disk space availability
- **7D9E.1**: Checking disk space for specific operations

### SystemBootTime Reason Codes
- **35F9.1**: Measure time for performance analysis
- **8FFB.1**: Calculate absolute timestamps from time intervals

## Testing

To verify the privacy manifest is properly included:

1. Run an EAS build:
   ```bash
   eas build --platform ios --profile production
   ```

2. Submit to App Store Connect
3. Apple will validate the privacy manifest and email you within minutes if any required reasons are missing

## Updating the Manifest

If Apple reports missing API declarations:

1. Update `ios/PrivacyInfo.xcprivacy` with the new API categories and reason codes
2. Rebuild and resubmit

To find which APIs are used by dependencies, check:
```bash
find node_modules -name "PrivacyInfo.xcprivacy" -exec echo {} \; -exec cat {} \;
```

## References

- [Apple Privacy Manifest Documentation](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Expo Privacy Manifest Guide](https://docs.expo.dev/guides/apple-privacy/)
- [Required Reason API Reference](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

## Related Tasks

- Task GID: 1213273369613473
- Implementation Date: 2026-02-14
