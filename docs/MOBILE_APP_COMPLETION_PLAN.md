# ShadowSky Mobile Apps Completion Plan

**Document Version**: 1.0
**Created**: 2025-12-15
**Status**: Active Development
**Asana Tasks**:
- Main: https://app.asana.com/0/1211710875848660/1212439104231965
- Reference: https://app.asana.com/1/19421316985/project/1212422036088963/task/1212411755134227

## Executive Summary

The ShadowSky mobile apps (iOS and Android) are currently in the **foundation stage** with React Native infrastructure established but most features requiring implementation. This plan outlines the path to completion for both platforms.

### Current State (v0.7.0)

**✅ Infrastructure Complete:**
- React Native 0.73.6 project structure established
- Navigation architecture (React Navigation v6) fully designed
- Deep linking configured (custom schemes + universal links)
- Authentication context/storage layer implemented
- Build configuration (iOS + Android) ready
- TypeScript configuration complete
- Developer guides (Android Signing, Apple Developer setup) documented

**⚠️ Features In Progress:**
- 17 screen components created (placeholder/skeleton state)
- Basic navigation flow implemented
- AT Protocol integration partially complete

**❌ Not Yet Implemented:**
- Core functionality (posting, feeds, notifications)
- AT Protocol service integration
- Media handling (images, videos)
- Real-time updates
- UI components library
- Testing infrastructure
- CI/CD pipeline
- App store presence

## Architecture Overview

### Technology Stack

- **Framework**: React Native 0.73.6
- **Language**: TypeScript 5.9
- **Navigation**: React Navigation v6 (Native Stack, Bottom Tabs, Drawer)
- **State Management**: TanStack React Query v5 + Context API
- **Storage**: AsyncStorage (@react-native-async-storage)
- **API**: @atproto/api v0.16.7
- **UI**: React Native components + custom styling

### Project Structure

```
mobile/
├── android/               # Android native project
│   └── app/
│       └── src/main/
│           └── AndroidManifest.xml  # Deep linking configured
├── ios/                   # iOS native project
│   └── ShadowSky/
│       ├── Info.plist     # URL schemes configured
│       └── ShadowSky.entitlements  # Associated domains
├── src/
│   ├── contexts/         # AuthContext (implemented)
│   ├── hooks/            # useNavigation (implemented)
│   ├── navigation/       # Complete navigation architecture
│   │   ├── stacks/      # HomeStack, SearchStack, NotificationsStack, ProfileStack
│   │   ├── TabNavigator.tsx
│   │   ├── DrawerNavigator.tsx
│   │   ├── RootNavigator.tsx
│   │   └── linking.ts   # Deep linking configuration
│   ├── screens/         # 17 screen components (placeholders)
│   │   ├── auth/        # LandingScreen, OAuthCallbackScreen
│   │   ├── home/        # HomeScreen, TimelineScreen
│   │   ├── search/      # SearchScreen
│   │   ├── notifications/  # NotificationsScreen, NotificationsAnalyticsScreen
│   │   ├── profile/     # ProfileScreen, BookmarksScreen, MessagesScreen
│   │   ├── compose/     # ComposeScreen
│   │   ├── settings/    # SettingsScreen
│   │   ├── analytics/   # AnalyticsScreen
│   │   ├── scheduled/   # ScheduledPostsScreen
│   │   ├── lists/       # ListsScreen, ListTimelineScreen
│   │   └── shared/      # ThreadScreen
│   ├── types/           # Navigation types (implemented)
│   └── mobile/          # Shared mobile components (partial)
├── App.tsx              # Root component configured
└── package.json         # Dependencies configured
```

## Development Phases

### Phase 1: Core Infrastructure Enhancement (2-3 weeks)

**Goal**: Complete the foundational services and shared components needed by all features.

#### 1.1 AT Protocol Services Layer
- [ ] Create AT Protocol client wrapper with authentication
- [ ] Implement session management with token refresh
- [ ] Add error handling and retry logic
- [ ] Create API service hooks (useFeed, useProfile, useNotifications)
- [ ] Implement caching strategy with React Query
- [ ] Add rate limiting awareness

**Files to Create:**
- `src/services/atproto/client.ts`
- `src/services/atproto/auth.ts`
- `src/services/atproto/feeds.ts`
- `src/services/atproto/posts.ts`
- `src/services/atproto/profiles.ts`
- `src/services/atproto/notifications.ts`
- `src/hooks/api/useFeed.ts`
- `src/hooks/api/useProfile.ts`
- `src/hooks/api/useNotifications.ts`

#### 1.2 Shared UI Components Library
- [ ] PostCard component (with engagement actions)
- [ ] FeedList component (virtualized)
- [ ] Avatar component
- [ ] Button components (primary, secondary, icon)
- [ ] Input components (text, textarea, search)
- [ ] Loading states (spinner, skeleton)
- [ ] Error states
- [ ] Empty states
- [ ] Modal/Bottom sheet components
- [ ] Image viewer component
- [ ] Video player component

**Files to Create:**
- `src/components/PostCard.tsx`
- `src/components/FeedList.tsx`
- `src/components/Avatar.tsx`
- `src/components/Button.tsx`
- `src/components/Input.tsx`
- `src/components/LoadingState.tsx`
- `src/components/ErrorState.tsx`
- `src/components/EmptyState.tsx`
- `src/components/Modal.tsx`
- `src/components/ImageViewer.tsx`
- `src/components/VideoPlayer.tsx`

#### 1.3 Storage & Cache Strategy
- [ ] Implement AsyncStorage wrapper for offline support
- [ ] Create cache invalidation strategy
- [ ] Add draft storage for posts
- [ ] Implement bookmark storage (sync with web app)
- [ ] Add preference storage

**Files to Create:**
- `src/services/storage/async-storage.ts`
- `src/services/storage/cache-manager.ts`
- `src/services/storage/drafts.ts`
- `src/services/storage/bookmarks.ts`

**Acceptance Criteria:**
- AT Protocol client can authenticate and make requests
- Basic UI components render correctly on iOS and Android
- Data can be cached and retrieved offline
- Error states handled gracefully

---

### Phase 2: Authentication & Onboarding (1-2 weeks)

**Goal**: Implement complete authentication flow with OAuth support.

#### 2.1 Authentication Implementation
- [ ] Implement OAuth flow (web-based)
- [ ] Handle OAuth callback with deep linking
- [ ] Add session persistence
- [ ] Implement auto-refresh logic
- [ ] Add multi-account support
- [ ] Handle app password authentication
- [ ] Add biometric authentication (optional)

#### 2.2 Onboarding Flow
- [ ] Welcome/splash screen
- [ ] OAuth web view integration
- [ ] Account selection (multi-account)
- [ ] Permissions requests (notifications, etc.)
- [ ] Initial app tour (optional)

**Files to Update:**
- `src/screens/auth/LandingScreen.tsx` - Add OAuth button
- `src/screens/auth/OAuthCallbackScreen.tsx` - Handle OAuth redirect
- `src/contexts/AuthContext.tsx` - Enhance with OAuth + multi-account

**Files to Create:**
- `src/services/auth/oauth.ts`
- `src/services/auth/biometric.ts`
- `src/screens/auth/AccountSelectorScreen.tsx`
- `src/screens/auth/OnboardingScreen.tsx`

**Acceptance Criteria:**
- Users can sign in via OAuth
- Sessions persist across app restarts
- Multi-account switching works
- OAuth callback redirects handled correctly

---

### Phase 3: Core Features - Reading (2-3 weeks)

**Goal**: Implement read-only features (feeds, profiles, threads, search, notifications).

#### 3.1 Home Feed
- [ ] Implement timeline feed fetching
- [ ] Add infinite scroll with pagination
- [ ] Implement pull-to-refresh
- [ ] Add feed switching (Following, Discover, etc.)
- [ ] Display posts with media
- [ ] Show engagement metrics (likes, reposts, replies)
- [ ] Handle embedded content (quotes, links)

**Files to Update:**
- `src/screens/home/HomeScreen.tsx` - Implement feed display
- `src/screens/home/TimelineScreen.tsx` - Visual timeline view

#### 3.2 Profile Viewing
- [ ] Fetch and display user profiles
- [ ] Show profile header (avatar, banner, bio)
- [ ] Display user's posts
- [ ] Show follow/follower counts
- [ ] Add follow/unfollow action
- [ ] Tab navigation (Posts, Replies, Media, Likes)

**Files to Update:**
- `src/screens/profile/ProfileScreen.tsx` - Full profile implementation

#### 3.3 Thread Viewing
- [ ] Fetch thread with replies
- [ ] Display threaded conversation
- [ ] Show reply hierarchy
- [ ] Handle thread continuation
- [ ] Add reply indicators

**Files to Update:**
- `src/screens/shared/ThreadScreen.tsx` - Thread view implementation

#### 3.4 Search
- [ ] Implement search API integration
- [ ] Add tabbed search (Posts, Users, Feeds)
- [ ] Show search results with infinite scroll
- [ ] Add search history
- [ ] Implement search filters

**Files to Update:**
- `src/screens/search/SearchScreen.tsx` - Full search implementation

#### 3.5 Notifications
- [ ] Fetch notifications feed
- [ ] Display notification types (likes, reposts, follows, mentions, replies)
- [ ] Mark notifications as read
- [ ] Add notification grouping
- [ ] Implement notification filters

**Files to Update:**
- `src/screens/notifications/NotificationsScreen.tsx` - Notifications feed
- `src/screens/notifications/NotificationsAnalyticsScreen.tsx` - Analytics view

**Acceptance Criteria:**
- Users can browse their timeline
- Profiles load and display correctly
- Threads show full conversation hierarchy
- Search returns relevant results
- Notifications display and update

---

### Phase 4: Core Features - Writing (2-3 weeks)

**Goal**: Implement content creation and engagement features.

#### 4.1 Post Composition
- [ ] Implement text post creation
- [ ] Add character counter (300 chars)
- [ ] Image attachment (up to 4 images)
- [ ] Video attachment
- [ ] GIF picker integration
- [ ] Quote post functionality
- [ ] Thread creation (multi-post)
- [ ] Draft saving
- [ ] Alt text for images

**Files to Update:**
- `src/screens/compose/ComposeScreen.tsx` - Full composer implementation

**Files to Create:**
- `src/components/composer/ImagePicker.tsx`
- `src/components/composer/VideoPicker.tsx`
- `src/components/composer/GifPicker.tsx`
- `src/components/composer/ThreadComposer.tsx`
- `src/components/composer/AltTextEditor.tsx`

#### 4.2 Engagement Actions
- [ ] Implement like/unlike
- [ ] Implement repost/unrepost
- [ ] Implement reply
- [ ] Add quote post
- [ ] Share post (native share sheet)
- [ ] Copy link
- [ ] Report post
- [ ] Block/mute user

**Files to Create:**
- `src/services/engagement/actions.ts`
- `src/components/EngagementBar.tsx`
- `src/components/PostMenu.tsx`

#### 4.3 Replies
- [ ] Reply composition screen
- [ ] Show parent post context
- [ ] Threading support
- [ ] Mention autocomplete

**Files to Create:**
- `src/screens/compose/ReplyScreen.tsx`

**Acceptance Criteria:**
- Users can create text posts
- Image and video attachments work
- Drafts are saved automatically
- Like, repost, reply actions function correctly
- Share functionality uses native share sheet

---

### Phase 5: Advanced Features (2-3 weeks)

**Goal**: Implement ShadowSky-specific features and advanced functionality.

#### 5.1 Lists
- [ ] Display user's lists
- [ ] Show list timeline
- [ ] Create/edit/delete lists
- [ ] Add/remove users from lists

**Files to Update:**
- `src/screens/lists/ListsScreen.tsx`
- `src/screens/lists/ListTimelineScreen.tsx`

**Files to Create:**
- `src/screens/lists/CreateListScreen.tsx`
- `src/screens/lists/EditListScreen.tsx`

#### 5.2 Bookmarks
- [ ] Display bookmarked posts
- [ ] Add/remove bookmarks
- [ ] Sync with AT Protocol storage
- [ ] Bookmark folders/categories

**Files to Update:**
- `src/screens/profile/BookmarksScreen.tsx`

#### 5.3 Direct Messages
- [ ] Display conversations list
- [ ] Show message thread
- [ ] Send/receive messages
- [ ] Message notifications

**Files to Update:**
- `src/screens/profile/MessagesScreen.tsx`

**Files to Create:**
- `src/screens/messages/ConversationScreen.tsx`
- `src/screens/messages/NewMessageScreen.tsx`

#### 5.4 Scheduled Posts
- [ ] Display scheduled posts
- [ ] Create scheduled post
- [ ] Edit/delete scheduled post
- [ ] Post scheduling notifications

**Files to Update:**
- `src/screens/scheduled/ScheduledPostsScreen.tsx`

#### 5.5 Analytics
- [ ] Display post analytics
- [ ] Show engagement trends
- [ ] Profile analytics
- [ ] Notification analytics

**Files to Update:**
- `src/screens/analytics/AnalyticsScreen.tsx`

#### 5.6 Settings
- [ ] Account settings
- [ ] Appearance settings (theme)
- [ ] Notification preferences
- [ ] Privacy settings
- [ ] Storage settings
- [ ] About/help screens

**Files to Update:**
- `src/screens/settings/SettingsScreen.tsx`

**Files to Create:**
- `src/screens/settings/AccountSettingsScreen.tsx`
- `src/screens/settings/AppearanceSettingsScreen.tsx`
- `src/screens/settings/NotificationSettingsScreen.tsx`
- `src/screens/settings/PrivacySettingsScreen.tsx`
- `src/screens/settings/AboutScreen.tsx`

**Acceptance Criteria:**
- Lists can be created and managed
- Bookmarks sync across devices
- Messages can be sent and received
- Scheduled posts execute correctly
- Analytics display relevant metrics
- Settings are persisted

---

### Phase 6: Media & Rich Content (1-2 weeks)

**Goal**: Enhance media handling and rich content display.

#### 6.1 Image Handling
- [ ] Image optimization and compression
- [ ] Image cropping/editing
- [ ] Multi-image galleries
- [ ] Image caching
- [ ] Pinch-to-zoom

#### 6.2 Video Handling
- [ ] Video player with controls
- [ ] Video thumbnail generation
- [ ] Video compression
- [ ] Video upload progress
- [ ] Auto-play in feed (optional)

#### 6.3 Link Previews
- [ ] Fetch and display link cards
- [ ] Cache link metadata
- [ ] Handle various content types

#### 6.4 Rich Text
- [ ] Mention highlighting
- [ ] Hashtag highlighting
- [ ] Link detection and highlighting
- [ ] Emoji support

**Files to Create:**
- `src/components/media/ImageGallery.tsx`
- `src/components/media/VideoPlayer.tsx`
- `src/components/media/LinkPreview.tsx`
- `src/components/text/RichText.tsx`
- `src/utils/media/image-processor.ts`
- `src/utils/media/video-processor.ts`

**Acceptance Criteria:**
- Images load quickly and cache correctly
- Videos play smoothly
- Link previews display rich metadata
- Mentions and hashtags are interactive

---

### Phase 7: Real-time & Push Notifications (1-2 weeks)

**Goal**: Add real-time updates and push notifications.

#### 7.1 Push Notifications
- [ ] Configure Firebase Cloud Messaging (Android)
- [ ] Configure Apple Push Notification Service (iOS)
- [ ] Register device tokens
- [ ] Handle notification permissions
- [ ] Display notification badges
- [ ] Handle notification taps (deep linking)
- [ ] Notification preferences

#### 7.2 Real-time Updates (Optional)
- [ ] Implement WebSocket connection
- [ ] Real-time feed updates
- [ ] Live notification updates
- [ ] Online/offline status

**Files to Create:**
- `src/services/notifications/push-manager.ts`
- `src/services/notifications/fcm.ts` (Android)
- `src/services/notifications/apns.ts` (iOS)
- `src/services/realtime/websocket.ts`

**Native Code Files to Create:**
- `android/app/src/main/java/.../NotificationService.java`
- `ios/ShadowSky/NotificationService.swift`

**Acceptance Criteria:**
- Push notifications received on both platforms
- Notification taps navigate to correct screen
- Notification badges display correctly
- Users can configure notification preferences

---

### Phase 8: Testing & Quality Assurance (2-3 weeks)

**Goal**: Ensure app stability, performance, and quality.

#### 8.1 Unit Testing
- [ ] Test utility functions
- [ ] Test service layers
- [ ] Test hooks
- [ ] Test context providers
- [ ] Aim for >70% code coverage

#### 8.2 Integration Testing
- [ ] Test navigation flows
- [ ] Test authentication flows
- [ ] Test API integrations
- [ ] Test storage operations

#### 8.3 E2E Testing
- [ ] Test critical user flows (login, post, feed)
- [ ] Test deep linking
- [ ] Test offline functionality
- [ ] Test multi-account switching

#### 8.4 Performance Testing
- [ ] Profile app performance
- [ ] Optimize list rendering
- [ ] Reduce bundle size
- [ ] Optimize images/media
- [ ] Memory leak detection

#### 8.5 Accessibility Testing
- [ ] VoiceOver support (iOS)
- [ ] TalkBack support (Android)
- [ ] Keyboard navigation
- [ ] Color contrast compliance
- [ ] Touch target sizes (min 44x44)

**Testing Configuration:**
- [ ] Set up Jest for unit tests
- [ ] Set up React Native Testing Library
- [ ] Set up Detox for E2E tests
- [ ] Configure test coverage reporting

**Files to Create:**
- `__tests__/` directory structure
- `jest.config.js`
- `detox.config.js`
- `.detoxrc.json`

**Acceptance Criteria:**
- Unit tests pass with >70% coverage
- E2E tests cover critical flows
- Performance metrics meet targets (see below)
- Accessibility audit passes

**Performance Targets:**
- App launch time: <3 seconds
- Time to interactive: <5 seconds
- Feed scroll: 60 FPS
- Image load time: <1 second
- API response handling: <500ms

---

### Phase 9: CI/CD & Release Infrastructure (1-2 weeks)

**Goal**: Automate builds, testing, and releases.

#### 9.1 Continuous Integration
- [ ] Set up GitHub Actions for mobile
- [ ] Automated testing on PRs
- [ ] Build verification
- [ ] Linting and type checking
- [ ] Code coverage reporting

#### 9.2 Continuous Deployment
- [ ] Set up EAS Build (Expo)
- [ ] Configure build profiles (development, preview, production)
- [ ] Automate TestFlight uploads (iOS)
- [ ] Automate Google Play internal testing (Android)
- [ ] Version bumping automation

#### 9.3 Release Management
- [ ] Set up semantic versioning
- [ ] Create release notes template
- [ ] Configure code signing
- [ ] Set up fastlane (optional)

**Files to Create:**
- `.github/workflows/mobile-ci.yml`
- `.github/workflows/mobile-release.yml`
- `eas.json` (EAS Build configuration)
- `fastlane/Fastfile` (optional)

**Acceptance Criteria:**
- Builds run automatically on PR
- Tests run on every commit
- Production builds can be created with one command
- Apps can be deployed to TestFlight/Play Store

---

### Phase 10: App Store Deployment (1-2 weeks)

**Goal**: Launch apps on iOS App Store and Google Play Store.

#### 10.1 iOS App Store
- [ ] Complete Apple Developer account setup (see docs/guides/APPLE_DEVELOPER_SETUP.md)
- [ ] Create App Store Connect listing
- [ ] Prepare app screenshots (required sizes)
- [ ] Write app description and keywords
- [ ] Set up app privacy details
- [ ] Submit for review
- [ ] Address review feedback
- [ ] Release to App Store

#### 10.2 Google Play Store
- [ ] Complete Google Play Console setup
- [ ] Generate signing key (see docs/guides/ANDROID_SIGNING_SETUP.md)
- [ ] Create Play Store listing
- [ ] Prepare app screenshots (required sizes)
- [ ] Write app description
- [ ] Set up app privacy details
- [ ] Submit for review
- [ ] Address review feedback
- [ ] Release to Play Store

#### 10.3 App Store Assets
- [ ] App icons (all required sizes)
- [ ] Splash screen
- [ ] Screenshots (iOS: 6.7", 6.5", 5.5" displays)
- [ ] Screenshots (Android: phone, tablet, 7", 10" tablets)
- [ ] Promotional graphics
- [ ] App preview video (optional)

#### 10.4 Universal Links / App Links
- [ ] Deploy `apple-app-site-association` file to shadowsky.io
- [ ] Deploy `assetlinks.json` file to shadowsky.io
- [ ] Verify universal links work
- [ ] Test app links work

**Acceptance Criteria:**
- Apps approved by both app stores
- Apps available for download
- Deep linking works from web to app
- App store listings are complete and attractive

---

## Dependencies & Prerequisites

### Required Accounts & Credentials

1. **Apple Developer Account** ($99/year)
   - Team ID
   - Bundle ID: `io.shadowsky.app`
   - Distribution certificate
   - Provisioning profiles
   - App Store Connect access
   - See: `docs/guides/APPLE_DEVELOPER_SETUP.md`

2. **Google Play Console** ($25 one-time)
   - Developer account
   - Package name: `io.shadowsky.app`
   - Signing key and fingerprint
   - See: `docs/guides/ANDROID_SIGNING_SETUP.md`

3. **Firebase** (for push notifications)
   - Firebase project created
   - FCM configured for Android
   - APNs key configured for iOS

4. **Expo Account** (for EAS Build)
   - Free tier available
   - Paid tier for advanced features

### Development Environment

#### macOS (required for iOS development)
- Xcode 14+ with Command Line Tools
- CocoaPods installed
- iOS Simulator
- Ruby (for CocoaPods)

#### Android Development
- Android Studio
- Android SDK
- Android Emulator or physical device
- Java Development Kit (JDK) 11+

#### Node.js Environment
- Node.js 18+
- npm or yarn
- React Native CLI: `npm install -g react-native-cli`

### External Dependencies (Web App Features)

Some mobile features depend on web app infrastructure:

1. **Scheduled Posts** - Requires web app's scheduling service
2. **Analytics** - Requires web app's analytics backend
3. **AT Protocol Storage** - Bookmarks, drafts, preferences sync

## Technical Challenges & Considerations

### 1. Cross-platform Consistency

**Challenge**: Ensuring iOS and Android apps behave consistently.

**Approach**:
- Use React Native's cross-platform components
- Abstract platform-specific code into separate modules
- Test on both platforms regularly
- Use Platform.select() for platform-specific styling

### 2. Offline Support

**Challenge**: App should work offline and sync when online.

**Approach**:
- Cache data with React Query
- Store drafts locally
- Queue actions for later (optimistic updates)
- Display offline indicators

### 3. Performance with Large Feeds

**Challenge**: Rendering large lists efficiently.

**Approach**:
- Use FlatList with proper optimization
- Implement virtualization
- Lazy load images
- Paginate API requests
- Memoize components

### 4. Media Handling

**Challenge**: Uploading and displaying images/videos efficiently.

**Approach**:
- Compress images before upload
- Use CDN for media delivery
- Cache media locally
- Progressive image loading
- Video transcoding (if needed)

### 5. AT Protocol Integration

**Challenge**: Mobile app needs similar functionality to web app.

**Approach**:
- Reuse AT Protocol logic patterns from web app
- Create mobile-specific service layer
- Handle authentication consistently
- Implement proper error handling

### 6. Deep Linking

**Challenge**: Handling deep links from web to app.

**Approach**:
- Configure universal links (iOS) and app links (Android)
- Test all URL patterns
- Handle edge cases (not logged in, app not installed)
- Graceful fallback to web

### 7. Push Notifications

**Challenge**: Reliable notification delivery.

**Approach**:
- Use Firebase Cloud Messaging (Android)
- Use APNs (iOS)
- Handle notification permissions gracefully
- Test notification receipt and handling

### 8. App Store Review

**Challenge**: Passing app store review processes.

**Approach**:
- Follow App Store Review Guidelines
- Follow Google Play policies
- Ensure privacy policy is clear
- Test all features thoroughly
- Respond quickly to reviewer feedback

## Resource Requirements

### Team Composition (Recommended)

- **1 Senior React Native Developer** - Lead mobile development
- **1 Mobile Developer** (iOS/Android) - Native code, platform-specific features
- **1 Backend Developer** - API integration, push notifications
- **1 QA Engineer** - Testing, automation
- **1 UI/UX Designer** - Mobile app design, app store assets

### Timeline Estimate

**Total Duration**: 16-22 weeks (4-5.5 months)

- Phase 1: Infrastructure (2-3 weeks)
- Phase 2: Authentication (1-2 weeks)
- Phase 3: Reading Features (2-3 weeks)
- Phase 4: Writing Features (2-3 weeks)
- Phase 5: Advanced Features (2-3 weeks)
- Phase 6: Media & Rich Content (1-2 weeks)
- Phase 7: Real-time & Notifications (1-2 weeks)
- Phase 8: Testing & QA (2-3 weeks)
- Phase 9: CI/CD (1-2 weeks)
- Phase 10: App Store Deployment (1-2 weeks)

**Note**: Phases 1-3 can have some parallelization. Timeline assumes full-time development with a team of 2-3 developers.

### Budget Considerations

**One-time Costs**:
- Apple Developer Program: $99/year
- Google Play Console: $25 (one-time)
- Design assets (if outsourced): $500-2000

**Ongoing Costs**:
- EAS Build (Expo): $0-299/month depending on plan
- Firebase (Push notifications): $0-25/month (free tier likely sufficient)
- Code signing services: $0 (if using local signing)

**Total Estimated First Year**: $150-500 (excluding developer salaries)

## Success Metrics

### Phase Completion Metrics

- [ ] All screens implemented and functional
- [ ] All features from web app available on mobile (or planned for future)
- [ ] No critical bugs
- [ ] Performance targets met
- [ ] Accessibility requirements met
- [ ] Apps approved by both app stores
- [ ] Apps available for download

### Key Performance Indicators (KPIs)

**Technical KPIs**:
- App crash rate: <1%
- App launch time: <3 seconds
- Time to interactive: <5 seconds
- API response time: <500ms
- Test coverage: >70%

**User KPIs** (after launch):
- App store rating: >4.0 stars
- Daily active users: Target TBD
- User retention (Day 7): >40%
- Session duration: Target TBD
- Posts created on mobile: Target TBD

## Risk Assessment

### High Priority Risks

1. **Apple Review Rejection**
   - **Probability**: Medium
   - **Impact**: High
   - **Mitigation**: Follow guidelines strictly, prepare for iteration

2. **Performance Issues**
   - **Probability**: Medium
   - **Impact**: High
   - **Mitigation**: Profile early and often, optimize incrementally

3. **AT Protocol API Changes**
   - **Probability**: Low-Medium
   - **Impact**: Medium
   - **Mitigation**: Monitor API changes, maintain abstraction layer

4. **Scope Creep**
   - **Probability**: High
   - **Impact**: Medium
   - **Mitigation**: Stick to MVP for v1.0, plan v2.0 features separately

### Medium Priority Risks

5. **Cross-platform Inconsistencies**
   - **Probability**: Medium
   - **Impact**: Medium
   - **Mitigation**: Test on both platforms frequently

6. **Third-party Library Issues**
   - **Probability**: Medium
   - **Impact**: Low-Medium
   - **Mitigation**: Vet dependencies, have fallback options

7. **Push Notification Reliability**
   - **Probability**: Low
   - **Impact**: Medium
   - **Mitigation**: Use reliable services (FCM, APNs), implement retry logic

## Future Enhancements (Post-v1.0)

### Version 2.0 Features
- [ ] Widgets (home screen, lock screen)
- [ ] iPad-optimized layout
- [ ] Android tablet layout
- [ ] Siri shortcuts (iOS)
- [ ] Android widgets
- [ ] Apple Watch companion app
- [ ] Wear OS companion app

### Version 2.1+ Features
- [ ] Multi-column view (tablet)
- [ ] Advanced moderation tools
- [ ] Custom feeds
- [ ] Advanced analytics
- [ ] AI-powered features (alt-text, tone adjustment)
- [ ] Video editing
- [ ] Podcast features
- [ ] Translation features

## References & Documentation

### Existing Documentation
- `/mobile/src/navigation/README.md` - Navigation architecture
- `/docs/guides/APPLE_DEVELOPER_SETUP.md` - Apple setup guide
- `/docs/guides/ANDROID_SIGNING_SETUP.md` - Android setup guide
- `/MOBILE_RESPONSIVENESS_GUIDE.md` - Mobile web responsiveness (reference)

### External Resources
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation Documentation](https://reactnavigation.org/docs/getting-started)
- [AT Protocol Documentation](https://atproto.com/docs)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Android Developer Documentation](https://developer.android.com/docs)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)

### Web App Codebase References

For consistency with the web app, reference these implementations:

- **Authentication**: `/src/contexts/AuthContext.tsx`
- **AT Protocol**: `/src/services/atproto/*`
- **Storage**: `/src/services/storage/*`
- **Bookmarks**: `/src/services/bookmark-backends/*`
- **Components**: `/src/components/*`

## Appendix A: Screen Implementation Checklist

### ✅ Implemented (Placeholder)
- [x] LandingScreen (auth)
- [x] OAuthCallbackScreen (auth)
- [x] HomeScreen (home)
- [x] TimelineScreen (home)
- [x] SearchScreen (search)
- [x] NotificationsScreen (notifications)
- [x] NotificationsAnalyticsScreen (notifications)
- [x] ProfileScreen (profile)
- [x] BookmarksScreen (profile)
- [x] MessagesScreen (profile)
- [x] ComposeScreen (compose)
- [x] SettingsScreen (settings)
- [x] AnalyticsScreen (analytics)
- [x] ScheduledPostsScreen (scheduled)
- [x] ListsScreen (lists)
- [x] ListTimelineScreen (lists)
- [x] ThreadScreen (shared)

### ❌ To Be Implemented (Full Functionality)
All screens above need full implementation beyond placeholder.

### 🆕 New Screens Needed
- [ ] AccountSelectorScreen
- [ ] OnboardingScreen
- [ ] ReplyScreen
- [ ] CreateListScreen
- [ ] EditListScreen
- [ ] ConversationScreen
- [ ] NewMessageScreen
- [ ] AccountSettingsScreen
- [ ] AppearanceSettingsScreen
- [ ] NotificationSettingsScreen
- [ ] PrivacySettingsScreen
- [ ] AboutScreen

## Appendix B: API Coverage Matrix

| Feature | Web App API | Mobile API | Status |
|---------|-------------|------------|--------|
| Authentication | ✅ | ❌ | Not Started |
| Get Feed | ✅ | ❌ | Not Started |
| Get Profile | ✅ | ❌ | Not Started |
| Get Notifications | ✅ | ❌ | Not Started |
| Create Post | ✅ | ❌ | Not Started |
| Like Post | ✅ | ❌ | Not Started |
| Repost | ✅ | ❌ | Not Started |
| Reply | ✅ | ❌ | Not Started |
| Follow User | ✅ | ❌ | Not Started |
| Block User | ✅ | ❌ | Not Started |
| Mute User | ✅ | ❌ | Not Started |
| Search | ✅ | ❌ | Not Started |
| Get Thread | ✅ | ❌ | Not Started |
| Upload Media | ✅ | ❌ | Not Started |
| Lists | ✅ | ❌ | Not Started |
| Bookmarks | ✅ | ❌ | Not Started |
| Drafts | ✅ | ❌ | Not Started |
| Scheduled Posts | ✅ | ❌ | Not Started |
| Analytics | ✅ | ❌ | Not Started |

## Appendix C: Component Library Status

| Component | Status | Priority |
|-----------|--------|----------|
| PostCard | ❌ Not Started | High |
| FeedList | ⚠️ Partial | High |
| Avatar | ❌ Not Started | High |
| Button | ❌ Not Started | High |
| Input | ❌ Not Started | High |
| LoadingState | ❌ Not Started | High |
| ErrorState | ❌ Not Started | High |
| EmptyState | ❌ Not Started | Medium |
| Modal | ❌ Not Started | Medium |
| ImageViewer | ❌ Not Started | Medium |
| VideoPlayer | ❌ Not Started | Medium |
| ImageGallery | ❌ Not Started | Low |
| LinkPreview | ❌ Not Started | Low |
| RichText | ❌ Not Started | Medium |
| EngagementBar | ❌ Not Started | High |
| PostMenu | ❌ Not Started | Medium |

## Appendix D: Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-15 | Initial comprehensive plan created |

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-12-15
**Next Review**: 2026-01-15
