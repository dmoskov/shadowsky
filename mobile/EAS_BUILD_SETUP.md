# EAS Build Setup Guide

This guide walks you through setting up Expo Application Services (EAS) for building and distributing ShadowSky mobile apps.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [iOS Configuration](#ios-configuration)
4. [Android Configuration](#android-configuration)
5. [Creating Your First Build](#creating-your-first-build)
6. [Setting Up OTA Updates](#setting-up-ota-updates)
7. [Common Issues](#common-issues)

## Prerequisites

- Node.js 18+ installed
- npm or yarn installed
- Git installed
- An Expo account (sign up at https://expo.dev)
- For iOS builds: Apple Developer account ($99/year)
- For Android builds: Google Play Developer account ($25 one-time)

## Initial Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

This will install all required packages including `expo-updates` for OTA updates.

### 2. Install EAS CLI

```bash
npm install -g eas-cli
```

Or use it via npx:
```bash
npx eas-cli --version
```

### 3. Login to Expo

```bash
npx eas-cli login
```

Enter your Expo account credentials. If you don't have an account, create one at https://expo.dev/signup.

### 4. Initialize EAS Project

```bash
npx eas-cli init
```

This command will:
- Create an EAS project linked to your Expo account
- Generate a project ID
- Update `app.config.ts` with the project ID
- Update `eas.json` with the correct project configuration

**Important**: After running this, commit the updated `app.config.ts` to version control.

## iOS Configuration

### Step 1: Apple Developer Account Setup

1. Enroll in the Apple Developer Program at https://developer.apple.com
2. Pay the $99/year membership fee
3. Wait for enrollment confirmation (can take 24-48 hours)

### Step 2: Configure Bundle Identifier

The bundle identifier is already set in `app.config.ts`:
```typescript
ios: {
  bundleIdentifier: "io.asphodel.app"
}
```

You need to register this identifier in Apple Developer Portal:

1. Go to https://developer.apple.com/account/resources/identifiers
2. Click the "+" button to add a new identifier
3. Select "App IDs" and click "Continue"
4. Select "App" and click "Continue"
5. Enter:
   - Description: "ShadowSky"
   - Bundle ID: "io.asphodel.app" (Explicit)
6. Select capabilities you need (Push Notifications, Associated Domains, etc.)
7. Click "Continue" and then "Register"

### Step 3: Configure EAS Credentials

EAS can automatically manage your iOS credentials:

```bash
npx eas-cli credentials
```

Follow the prompts to:
1. Select "iOS" platform
2. Choose "Set up new credentials"
3. Let EAS generate and manage:
   - Distribution Certificate
   - Push Notification Key (if needed)
   - Provisioning Profiles

**Alternative**: If you have existing credentials, you can upload them manually.

### Step 4: Test iOS Build

```bash
npm run build:preview:ios
```

This will:
- Queue a build on EAS servers
- Generate an `.ipa` file
- Provide a download link when complete

## Android Configuration

### Step 1: Google Play Developer Account

1. Go to https://play.google.com/console/signup
2. Pay the $25 one-time registration fee
3. Complete the account setup

### Step 2: Configure Package Name

The package name is already set in `app.config.ts`:
```typescript
android: {
  package: "io.shadowsky.app"
}
```

### Step 3: Generate Keystore

EAS can generate a keystore for you:

```bash
npx eas-cli credentials
```

Follow the prompts to:
1. Select "Android" platform
2. Choose "Set up new keystore"
3. Let EAS generate and securely store your keystore

**Important**: EAS will store your keystore securely. You can download it later if needed:
```bash
npx eas-cli credentials --platform android
```

**Alternative**: If you have an existing keystore:
```bash
npx eas-cli credentials --platform android
# Choose "Upload existing keystore"
```

### Step 4: Test Android Build

```bash
npm run build:preview:android
```

This will:
- Queue a build on EAS servers
- Generate an `.apk` file
- Provide a download link when complete

## Creating Your First Build

### Preview Build (Recommended for Testing)

Preview builds are perfect for internal testing:

```bash
# Build for both platforms
npm run build:preview

# Or build for specific platform
npm run build:preview:ios
npm run build:preview:android
```

**iOS Output**: `.ipa` file (Ad Hoc distribution)
- Can be installed via TestFlight or direct installation (requires device UDID)
- Limited to 100 devices per year

**Android Output**: `.apk` file
- Can be installed directly on any device
- Requires enabling "Install from Unknown Sources"

### Development Build

Development builds include the Expo development client for debugging:

```bash
npm run build:development
```

Use this for:
- Testing native modules
- Debugging native code
- Development workflow with hot reload

### Production Build

Production builds are for App Store and Google Play submission:

```bash
npm run build:production:ios      # For App Store
npm run build:production:android  # For Google Play (.aab)
```

**Important**: Production builds require:
- Complete app metadata in App Store Connect / Google Play Console
- App Store review (iOS) or Google Play review (Android)
- All required assets (screenshots, descriptions, etc.)

## Setting Up OTA Updates

EAS Update allows you to push JavaScript and asset updates without rebuilding.

### 1. Verify Configuration

Check that `app.config.ts` includes:

```typescript
updates: {
  url: "https://u.expo.dev/[your-project-id]",
},
runtimeVersion: {
  policy: "appVersion",
},
```

This is already configured, but the project ID will be updated when you run `eas init`.

### 2. Create Update Branches

Update branches are created automatically when you publish your first update to each channel:

```bash
# Development channel
npm run update:development -- "Initial setup"

# Preview channel
npm run update:preview -- "Initial setup"

# Production channel
npm run update:production -- "Initial setup"
```

### 3. Verify Update Configuration

After publishing, verify in the EAS dashboard:
1. Go to https://expo.dev
2. Navigate to your project
3. Click on "Updates" tab
4. You should see your update branches

### 4. Test OTA Updates

1. Install a preview build on a device
2. Make a JavaScript change (e.g., modify a text string)
3. Publish an update:
   ```bash
   npm run update:preview -- "Test update"
   ```
4. Force close and reopen the app
5. The update should be applied automatically

## Common Issues

### Issue: "Build failed - credentials not found"

**Solution**: Configure credentials:
```bash
npx eas-cli credentials
```

### Issue: "Bundle identifier / package name already registered"

**Solution**: This is expected. The identifier/package is registered to your account. EAS will use it.

### Issue: "iOS build fails with provisioning profile error"

**Solution**:
1. Clear existing credentials: `npx eas-cli credentials`
2. Select "Remove credentials"
3. Set up credentials again from scratch

### Issue: "Android build fails with keystore error"

**Solution**:
```bash
# Reset Android credentials
npx eas-cli credentials --platform android
# Remove and regenerate keystore
```

### Issue: "OTA update not appearing on device"

**Solution**:
1. Verify the build was created with the correct channel
2. Check runtime version matches (use `appVersion` policy)
3. Force close and reopen the app
4. Check internet connection
5. Verify update was published: `npx eas-cli update:list`

### Issue: "Build taking too long"

**Solution**:
- Builds can take 5-20 minutes depending on queue and complexity
- Monitor progress: https://expo.dev/accounts/[account]/projects/shadowsky/builds
- Consider upgrading resource class in `eas.json` for faster builds

### Issue: "Cannot install iOS .ipa on device"

**Solution**:
- For Ad Hoc builds, device UDID must be registered
- Add device: `npx eas-cli device:create`
- Rebuild after adding device
- Alternative: Use TestFlight for easier distribution

## Next Steps

1. **Set up CI/CD**: Integrate EAS builds into your CI/CD pipeline
2. **Configure TestFlight**: Set up beta testing for iOS
3. **Internal Testing Track**: Set up internal testing for Android
4. **Monitoring**: Set up error tracking and analytics
5. **Update Strategy**: Plan your OTA update strategy

## Resources

- **EAS Documentation**: https://docs.expo.dev/build/introduction/
- **EAS Update Guide**: https://docs.expo.dev/eas-update/introduction/
- **Expo Forums**: https://forums.expo.dev
- **Discord**: https://chat.expo.dev

## Support

If you encounter issues:

1. Check the EAS build logs in the dashboard
2. Search Expo forums for similar issues
3. Ask in the Expo Discord community
4. Review the [Expo documentation](https://docs.expo.dev)

---

**Last Updated**: 2025-02-11
