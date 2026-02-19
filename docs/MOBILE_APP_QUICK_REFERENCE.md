# ShadowSky Mobile Apps - Quick Reference

**Plan Document**: [MOBILE_APP_COMPLETION_PLAN.md](./MOBILE_APP_COMPLETION_PLAN.md)
**Last Updated**: 2025-12-15

## 📊 Current Status

**Version**: 0.7.0 (Foundation Stage)
**Infrastructure**: ✅ Complete
**Features**: ⚠️ 10% Complete (placeholders only)
**Release Status**: 🚧 Pre-Alpha

## 🎯 Quick Stats

- **Total Screens**: 17 created (all placeholders)
- **Navigation**: 100% complete
- **Authentication**: 30% complete (context only)
- **API Integration**: 0% complete
- **Testing**: 0% complete
- **CI/CD**: 0% complete

## 📅 Timeline Summary

| Phase                          | Duration  | Status         |
| ------------------------------ | --------- | -------------- |
| 1. Core Infrastructure         | 2-3 weeks | 🔴 Not Started |
| 2. Authentication & Onboarding | 1-2 weeks | 🔴 Not Started |
| 3. Reading Features            | 2-3 weeks | 🔴 Not Started |
| 4. Writing Features            | 2-3 weeks | 🔴 Not Started |
| 5. Advanced Features           | 2-3 weeks | 🔴 Not Started |
| 6. Media & Rich Content        | 1-2 weeks | 🔴 Not Started |
| 7. Real-time & Notifications   | 1-2 weeks | 🔴 Not Started |
| 8. Testing & QA                | 2-3 weeks | 🔴 Not Started |
| 9. CI/CD                       | 1-2 weeks | 🔴 Not Started |
| 10. App Store Deployment       | 1-2 weeks | 🔴 Not Started |

**Total Estimated**: 16-22 weeks (4-5.5 months)

## 🚀 Quick Start for Developers

### Prerequisites Checklist

#### Environment

- [ ] macOS (for iOS development)
- [ ] Xcode 14+ installed
- [ ] Android Studio installed
- [ ] Node.js 18+ installed
- [ ] React Native CLI installed

#### Accounts

- [ ] Apple Developer Account ($99/year)
- [ ] Google Play Console ($25 one-time)
- [ ] Firebase account (for push notifications)
- [ ] Expo account (for EAS Build)

### Run the App

```bash
# Install dependencies
cd mobile
npm install

# iOS
npm run ios

# Android
npm run android

# Start Metro bundler
npm start
```

## 🎯 Top 10 Priorities

1. **AT Protocol Service Layer** - Core API integration
2. **Authentication Flow** - OAuth implementation
3. **Feed Display** - Home timeline with posts
4. **Post Composition** - Create posts with media
5. **Profile Viewing** - Display user profiles
6. **Engagement Actions** - Like, repost, reply
7. **Notifications** - Display and mark as read
8. **Search** - Find posts and users
9. **Thread Viewing** - Display conversations
10. **Settings** - Basic app configuration

## 📱 Platform-Specific Notes

### iOS

- **Bundle ID**: `io.asphodel.app`
- **Minimum iOS**: 13.0
- **Deep Linking**: Custom scheme `bsky://` + Universal Links
- **Guide**: [docs/guides/APPLE_DEVELOPER_SETUP.md](./guides/APPLE_DEVELOPER_SETUP.md)

### Android

- **Package Name**: `io.shadowsky.app`
- **Minimum SDK**: 24 (Android 7.0)
- **Deep Linking**: Custom scheme `bsky://` + App Links
- **Guide**: [docs/guides/ANDROID_SIGNING_SETUP.md](./guides/ANDROID_SIGNING_SETUP.md)

## 🛠️ Tech Stack

| Category   | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | React Native 0.73.6                  |
| Language   | TypeScript 5.9                       |
| Navigation | React Navigation v6                  |
| State      | TanStack React Query v5              |
| Storage    | AsyncStorage                         |
| API        | @atproto/api v0.16.7                 |
| Testing    | Jest + Detox (planned)               |
| CI/CD      | GitHub Actions + EAS Build (planned) |

## 📂 Key Files

### Configuration

- `mobile/package.json` - Dependencies and scripts
- `mobile/App.tsx` - Root component
- `mobile/tsconfig.json` - TypeScript configuration

### iOS

- `mobile/ios/ShadowSky/Info.plist` - App configuration
- `mobile/ios/ShadowSky/ShadowSky.entitlements` - Universal Links

### Android

- `mobile/android/app/src/main/AndroidManifest.xml` - App configuration

### Navigation

- `mobile/src/navigation/RootNavigator.tsx` - Root navigation
- `mobile/src/navigation/linking.ts` - Deep linking configuration

### Documentation

- `mobile/src/navigation/README.md` - Navigation architecture
- `docs/MOBILE_APP_COMPLETION_PLAN.md` - Full implementation plan

## 🔗 Important Links

- **Asana Task**: https://app.asana.com/0/1211710875848660/1212439104231965
- **Related Task**: https://app.asana.com/1/19421316985/project/1212422036088963/task/1212411755134227
- **React Native Docs**: https://reactnative.dev/docs/getting-started
- **AT Protocol Docs**: https://atproto.com/docs

## 🎨 Design System

Mobile apps will follow the web app's design patterns:

- **Colors**: Dark theme (`#0a0a0f` background)
- **Primary**: Blue (`#3b82f6`)
- **Typography**: System fonts (SF Pro, Roboto)
- **Touch Targets**: Minimum 44x44 points (WCAG 2.1)

## 🧪 Testing Strategy

| Test Type     | Tool                         | Coverage Target    |
| ------------- | ---------------------------- | ------------------ |
| Unit Tests    | Jest                         | >70%               |
| Integration   | React Native Testing Library | Critical flows     |
| E2E Tests     | Detox                        | Key user journeys  |
| Performance   | React Native Profiler        | Launch <3s, 60 FPS |
| Accessibility | VoiceOver, TalkBack          | WCAG 2.1 AA        |

## 📊 Success Metrics

### Technical KPIs

- App crash rate: <1%
- App launch time: <3 seconds
- Time to interactive: <5 seconds
- API response time: <500ms
- Test coverage: >70%

### User KPIs (Post-Launch)

- App store rating: >4.0 stars
- User retention (Day 7): >40%
- Daily active users: TBD

## 🚧 Known Issues & TODOs

### High Priority

- [ ] No AT Protocol client implementation
- [ ] No OAuth flow
- [ ] No post fetching
- [ ] No post creation
- [ ] No media handling

### Medium Priority

- [ ] No push notifications
- [ ] No real-time updates
- [ ] No offline support
- [ ] No testing infrastructure

### Low Priority

- [ ] No analytics
- [ ] No scheduled posts
- [ ] No advanced features

## 🔐 Security Considerations

- Store sensitive credentials securely (Keychain/Keystore)
- Use HTTPS for all API calls
- Implement certificate pinning (optional)
- Handle authentication tokens securely
- Follow platform security best practices

## 💰 Cost Estimate (First Year)

| Item                    | Cost              |
| ----------------------- | ----------------- |
| Apple Developer Program | $99/year          |
| Google Play Console     | $25 (one-time)    |
| EAS Build (Expo)        | $0-299/month      |
| Firebase (Push)         | $0-25/month       |
| **Total**               | **$150-500/year** |

_Excludes developer salaries and design costs_

## 📞 Need Help?

- **Full Plan**: See [MOBILE_APP_COMPLETION_PLAN.md](./MOBILE_APP_COMPLETION_PLAN.md)
- **Navigation**: See [mobile/src/navigation/README.md](../mobile/src/navigation/README.md)
- **iOS Setup**: See [docs/guides/APPLE_DEVELOPER_SETUP.md](./guides/APPLE_DEVELOPER_SETUP.md)
- **Android Setup**: See [docs/guides/ANDROID_SIGNING_SETUP.md](./guides/ANDROID_SIGNING_SETUP.md)

## 🗺️ Roadmap at a Glance

```
v0.7.0 (Current) → Foundation
    ↓
v0.8.0 → Core Infrastructure + Auth
    ↓
v0.9.0 → Reading Features (Feeds, Profiles, Threads)
    ↓
v1.0.0 → Writing Features (Posts, Engagement)
    ↓
v1.1.0 → Advanced Features (Lists, Bookmarks, Messages)
    ↓
v1.2.0 → Real-time + Push Notifications
    ↓
v1.5.0 → App Store Launch
```

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-12-15
