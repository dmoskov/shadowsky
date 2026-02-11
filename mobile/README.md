# ShadowSky Mobile Apps

React Native mobile applications for iOS and Android.

## 📋 Status

**Version**: 0.7.0
**Status**: Foundation Stage (Pre-Alpha)

The mobile apps are currently in the foundation stage with infrastructure complete but core features pending implementation.

## 📚 Documentation

- **[Mobile App Completion Plan](../docs/MOBILE_APP_COMPLETION_PLAN.md)** - Comprehensive implementation plan
- **[Quick Reference Guide](../docs/MOBILE_APP_QUICK_REFERENCE.md)** - Quick start and key info
- **[Navigation Architecture](./src/navigation/README.md)** - Navigation structure and deep linking
- **[Apple Developer Setup](../docs/guides/APPLE_DEVELOPER_SETUP.md)** - iOS setup guide
- **[Android Signing Setup](../docs/guides/ANDROID_SIGNING_SETUP.md)** - Android setup guide

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- React Native CLI: `npm install -g react-native-cli`
- **iOS**: macOS with Xcode 14+, CocoaPods
- **Android**: Android Studio with SDK

### Installation

```bash
# Install dependencies
npm install

# iOS: Install pods
npm run pod-install

# Clean build (if needed)
npm run clean
```

### Running the App

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## 🏗️ Project Structure

```
mobile/
├── android/           # Android native project
├── ios/              # iOS native project
├── src/
│   ├── contexts/     # React contexts (Auth)
│   ├── hooks/        # Custom hooks
│   ├── navigation/   # Navigation setup
│   ├── screens/      # Screen components
│   ├── types/        # TypeScript types
│   └── mobile/       # Shared mobile components
├── App.tsx           # Root component
└── package.json      # Dependencies
```

## 📱 Available Scripts

### Development Scripts
```bash
npm run android       # Run on Android
npm run ios          # Run on iOS
npm start            # Start Metro bundler
npm test             # Run tests
npm run lint         # Lint code
npm run clean        # Clean build artifacts
npm run pod-install  # Install iOS pods
```

### EAS Build Scripts
```bash
# Build for all platforms
npm run build:development  # Development builds with development client
npm run build:preview      # Preview builds for internal testing
npm run build:production   # Production builds for App Store/Play Store

# Platform-specific builds
npm run build:preview:ios      # iOS preview build (.ipa)
npm run build:preview:android  # Android preview build (.apk)
npm run build:production:ios      # iOS production build
npm run build:production:android  # Android production build (.aab)

# OTA Updates
npm run update:development -- "Update message"  # Push OTA update to development
npm run update:preview -- "Update message"      # Push OTA update to preview
npm run update:production -- "Update message"   # Push OTA update to production
```

## 🎯 Current Implementation Status

### ✅ Complete
- React Native project structure
- Navigation architecture (React Navigation v6)
- Deep linking configuration
- Authentication context
- Build configuration (iOS + Android)
- TypeScript setup

### 🚧 In Progress
- 17 screen components (placeholder state)
- Basic navigation flow

### ❌ Not Yet Implemented
- AT Protocol service integration
- Core features (feeds, posting, profiles)
- Media handling
- Push notifications
- Testing infrastructure
- CI/CD pipeline

See the [Completion Plan](../docs/MOBILE_APP_COMPLETION_PLAN.md) for full details.

## 🔗 Deep Linking

The app supports multiple deep linking schemes:

### Custom URL Schemes
- `bsky://home` - Home screen
- `bsky://profile/{handle}` - Profile screen
- `bsky://profile/{handle}/post/{postId}` - Thread screen
- `shadowsky://...` - Alternate scheme

### Universal Links (iOS)
- `https://bsky.app/*`
- `https://staging.bsky.app/*`
- `https://shadowsky.io/*`
- `https://main.shadowsky.io/*`

### App Links (Android)
Same domains as Universal Links.

See [Navigation README](./src/navigation/README.md) for full linking documentation.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint
```

## 📦 Key Dependencies

- **React Native**: 0.73.6
- **React Navigation**: 6.x
- **@atproto/api**: 0.16.7
- **TanStack React Query**: 5.x
- **AsyncStorage**: 2.x
- **TypeScript**: 5.9.x

## 🎨 Platform-Specific Configuration

### iOS
- **Bundle ID**: `io.shadowsky.app` (to be configured)
- **Minimum iOS**: 13.0
- **Info.plist**: URL schemes configured
- **Entitlements**: Associated domains for Universal Links

### Android
- **Package Name**: `io.shadowsky.app` (to be configured)
- **Minimum SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)
- **AndroidManifest.xml**: Intent filters configured

## 🏗️ EAS Build & Updates

ShadowSky uses Expo Application Services (EAS) for building iOS and Android binaries and delivering over-the-air (OTA) updates.

### Prerequisites

1. **EAS Account**: Sign up at https://expo.dev
2. **Project Setup**: Run `npx eas-cli login` to authenticate
3. **Project Configuration**: Run `npx eas-cli init` to link the project

### Build Profiles

The app has three build profiles configured in `eas.json`:

#### Development Profile
- **Purpose**: Development builds with Expo development client
- **Distribution**: Internal (via Ad Hoc provisioning on iOS)
- **Output**:
  - iOS: `.ipa` file (device builds)
  - Android: `.apk` file (debug build)
- **Channel**: `development`
- **Usage**: `npm run build:development`

#### Preview Profile
- **Purpose**: Internal testing and QA
- **Distribution**: Internal (Ad Hoc on iOS, unsigned APK on Android)
- **Output**:
  - iOS: `.ipa` file for TestFlight or direct distribution
  - Android: `.apk` file for sideloading
- **Channel**: `preview`
- **Usage**: `npm run build:preview` or platform-specific commands

#### Production Profile
- **Purpose**: Official App Store and Google Play releases
- **Distribution**: Store (App Store on iOS, Google Play on Android)
- **Output**:
  - iOS: `.ipa` file for App Store submission
  - Android: `.aab` (Android App Bundle) for Play Store
- **Channel**: `production`
- **Usage**: `npm run build:production`

### Building Your App

#### First-Time Setup

1. **Login to EAS**:
   ```bash
   cd mobile
   npx eas-cli login
   ```

2. **Initialize Project** (if not done):
   ```bash
   npx eas-cli init
   ```
   This will create a project ID and update `app.config.ts` and `eas.json`.

3. **Configure Credentials**:
   ```bash
   # iOS: Set up Apple Developer credentials
   npx eas-cli credentials

   # Android: Generate or upload signing keystore
   npx eas-cli credentials
   ```

#### Building

```bash
# Preview builds (recommended for testing)
npm run build:preview:ios      # Build iOS .ipa
npm run build:preview:android  # Build Android .apk

# Production builds (for store submission)
npm run build:production:ios      # Build for App Store
npm run build:production:android  # Build for Play Store
```

**Build Status**: Monitor builds at https://expo.dev/accounts/[your-account]/projects/shadowsky/builds

#### Installing Builds

**iOS Preview (.ipa)**:
1. Download the .ipa from EAS dashboard
2. Install via TestFlight (recommended) or direct installation with tools like Apple Configurator
3. Or share the install link from EAS (requires device UDID registration)

**Android Preview (.apk)**:
1. Download the .apk from EAS dashboard
2. Transfer to device and install (enable "Install from Unknown Sources")
3. Or use the QR code/install link from EAS

### Over-The-Air (OTA) Updates

EAS Update allows you to push JavaScript/asset updates without rebuilding:

#### Publishing Updates

```bash
# Development channel
npm run update:development -- "Fix login bug"

# Preview channel
npm run update:preview -- "Add new feed layout"

# Production channel
npm run update:production -- "Critical security fix"
```

#### How OTA Updates Work

1. **Compatible Changes**: JS code, assets, and configuration changes that don't require native rebuilds
2. **Channels**: Each build profile subscribes to a channel (development, preview, production)
3. **Runtime Version**: Updates must match the app's runtime version (policy: `appVersion`)
4. **Automatic**: Apps check for updates on launch and in the background

#### What Requires a New Build

OTA updates **cannot** change:
- Native dependencies (e.g., adding a new native module)
- Native code modifications
- App version, bundle identifier, or permissions
- Splash screen or app icon

For these changes, you must create a new build.

#### Update Best Practices

1. **Test First**: Always test updates on development/preview before production
2. **Semantic Messages**: Use clear, descriptive update messages
3. **Rollback Ready**: Keep previous working builds available
4. **Monitor**: Check update success rates in EAS dashboard
5. **Version Alignment**: Ensure `runtimeVersion` policy matches your versioning strategy

### Configuration Files

#### `eas.json`
Defines build profiles, credentials, and submit configuration. Key settings:
- `developmentClient`: Enables Expo development client for debugging
- `distribution`: Controls how the app is distributed (internal/store)
- `resourceClass`: Build machine size (affects build speed)
- `channel`: Update channel for OTA updates

#### `app.config.ts`
Contains app configuration including:
- `updates.url`: EAS Update endpoint
- `runtimeVersion`: Version matching policy for updates
- `extra.eas.projectId`: Your EAS project ID
- Bundle identifiers: `io.shadowsky.app` (iOS and Android)

### Code Signing

#### iOS
- **Development/Preview**: Requires Apple Developer account and provisioning profiles
- **Production**: Requires distribution certificate and App Store provisioning profile
- EAS can manage certificates automatically or use existing credentials

#### Android
- **Development**: Uses debug keystore (automatically generated)
- **Preview/Production**: Requires release keystore
- EAS can generate a new keystore or use an existing one

See [Apple Developer Setup](../docs/guides/APPLE_DEVELOPER_SETUP.md) and [Android Signing Setup](../docs/guides/ANDROID_SIGNING_SETUP.md) for detailed guides.

### Troubleshooting EAS Builds

**Build Failed - Credentials Issue**:
```bash
# Reconfigure credentials
npx eas-cli credentials
```

**Build Failed - Dependencies**:
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**OTA Update Not Appearing**:
- Check that the runtime version matches
- Verify the update channel matches the build profile
- Try force-closing and reopening the app
- Check for errors in EAS dashboard

**Build Timeout**:
- Consider upgrading to a larger resource class in `eas.json`
- Reduce unnecessary dependencies
- Check for build script issues

### Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Update Docs**: https://docs.expo.dev/eas-update/introduction/
- **EAS Dashboard**: https://expo.dev
- **Build Status**: Check the EAS dashboard for real-time build progress
- **Update Insights**: Monitor update adoption and rollback if needed

## 🔐 App Store Configuration

### Required for Release

#### Apple Developer Account
- Team ID
- Bundle identifier
- Distribution certificate
- Provisioning profile
- See: [Apple Developer Setup Guide](../docs/guides/APPLE_DEVELOPER_SETUP.md)

#### Google Play Console
- Developer account
- Package name
- Signing key
- See: [Android Signing Guide](../docs/guides/ANDROID_SIGNING_SETUP.md)

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
# Clear Metro cache
npm start -- --reset-cache
```

### iOS Build Issues
```bash
# Clean iOS build
cd ios && xcodebuild clean && cd ..

# Reinstall pods
cd ios && pod install && cd ..
```

### Android Build Issues
```bash
# Clean Android build
cd android && ./gradlew clean && cd ..

# Clear Gradle cache
cd android && ./gradlew cleanBuildCache && cd ..
```

## 📖 Development Guidelines

1. **TypeScript**: Use strict typing, avoid `any`
2. **Components**: Follow React Native best practices
3. **Navigation**: Use typed navigation helpers from `useNavigation` hook
4. **Styling**: Use StyleSheet.create for performance
5. **Platform-Specific**: Use Platform.select() when needed
6. **Testing**: Write tests for new features
7. **Accessibility**: Follow WCAG 2.1 AA guidelines (min touch target: 44x44)

## 🤝 Contributing

1. Check the [Completion Plan](../docs/MOBILE_APP_COMPLETION_PLAN.md) for planned work
2. Follow existing code patterns
3. Test on both iOS and Android
4. Ensure accessibility compliance
5. Update documentation as needed

## 📞 Support

- **Issues**: Check GitHub issues
- **Asana**: https://app.asana.com/0/1211710875848660/1212439104231965
- **Docs**: [Mobile App Completion Plan](../docs/MOBILE_APP_COMPLETION_PLAN.md)

## 🗺️ Roadmap

See the [Completion Plan](../docs/MOBILE_APP_COMPLETION_PLAN.md) for the full 10-phase roadmap to v1.0.

**Current Phase**: Foundation Complete
**Next Phase**: Core Infrastructure Enhancement (Phase 1)
**Estimated Timeline**: 16-22 weeks to v1.0

---

**Last Updated**: 2025-12-15
