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

```bash
npm run android       # Run on Android
npm run ios          # Run on iOS
npm start            # Start Metro bundler
npm test             # Run tests
npm run lint         # Lint code
npm run clean        # Clean build artifacts
npm run pod-install  # Install iOS pods
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
