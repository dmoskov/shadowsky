# Navigation Architecture

This document describes the React Navigation v6 architecture for the ShadowSky mobile app.

## Navigator Hierarchy

```
RootNavigator (NativeStack)
├── Landing (auth screen)
├── OAuthCallback (auth callback)
└── Main → DrawerNavigator
    ├── Tabs → TabNavigator
    │   ├── HomeStack (NativeStack)
    │   │   ├── Home
    │   │   ├── Timeline
    │   │   ├── Thread
    │   │   ├── Profile
    │   │   └── ListTimeline
    │   ├── SearchStack (NativeStack)
    │   │   ├── Search
    │   │   ├── Thread
    │   │   └── Profile
    │   ├── Compose (modal)
    │   ├── NotificationsStack (NativeStack)
    │   │   ├── Notifications
    │   │   ├── NotificationsAnalytics
    │   │   ├── Thread
    │   │   └── Profile
    │   └── ProfileStack (NativeStack)
    │       ├── MyProfile
    │       ├── Profile
    │       ├── Thread
    │       ├── Bookmarks
    │       └── Messages
    ├── Settings
    ├── Analytics
    ├── ScheduledPosts
    └── Lists
```

## Route Mapping (Web → Mobile)

| Web Route | Mobile Screen | Navigator |
|-----------|---------------|-----------|
| `/` or `/home` | Home | HomeStack |
| `/timeline` | Timeline | HomeStack |
| `/profile/:handle` | Profile | HomeStack/SearchStack/etc |
| `/thread/:handle/:postId` | Thread | HomeStack/SearchStack/etc |
| `/search` | Search | SearchStack |
| `/compose` | Compose | TabNavigator (modal) |
| `/notifications` | Notifications | NotificationsStack |
| `/analytics/notifications` | NotificationsAnalytics | NotificationsStack |
| `/bookmarks` | Bookmarks | ProfileStack |
| `/messages` | Messages | ProfileStack |
| `/settings` | Settings | DrawerNavigator |
| `/settings/:section` | Settings | DrawerNavigator |
| `/analytics` | Analytics | DrawerNavigator |
| `/scheduled` | ScheduledPosts | DrawerNavigator |
| `/lists` | Lists | DrawerNavigator |
| `/lists/:listId` | ListTimeline | HomeStack |

## Deep Linking

### Custom URL Schemes
- `bsky://` - Primary scheme
- `shadowsky://` - Alternate scheme

### Universal Links
- `https://bsky.app/*`
- `https://staging.bsky.app/*`
- `https://shadowsky.io/*`
- `https://main.shadowsky.io/*`

### Example Deep Links

```
bsky://home                          → Home screen
bsky://search?q=bluesky              → Search with query
bsky://profile/alice.bsky.social    → Profile screen
bsky://profile/alice.bsky.social/post/abc123  → Thread screen
bsky://compose                       → Compose modal
bsky://notifications                 → Notifications
bsky://settings                      → Settings
bsky://settings/appearance          → Settings with section
```

## Usage

### Typed Navigation

```typescript
import { useAppNavigation } from '../hooks/useNavigation';

function MyComponent() {
  const { navigateToProfile, navigateToThread, navigateToCompose } = useAppNavigation();

  // Navigate to a profile
  navigateToProfile('alice.bsky.social');

  // Navigate to a thread
  navigateToThread('alice.bsky.social', 'abc123');

  // Open compose modal
  navigateToCompose();
}
```

### Screen Props

Each screen receives typed props:

```typescript
import type { HomeStackScreenProps } from '../types/navigation';

type Props = HomeStackScreenProps<'Profile'>;

function ProfileScreen({ route, navigation }: Props) {
  const { handle } = route.params;
  // ...
}
```

## Configuration Files

- **iOS**: `ios/ShadowSky/Info.plist` - URL schemes
- **iOS**: `ios/ShadowSky/ShadowSky.entitlements` - Associated domains
- **Android**: `android/app/src/main/AndroidManifest.xml` - Intent filters
