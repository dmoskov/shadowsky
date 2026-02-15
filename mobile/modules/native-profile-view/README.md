# Native Profile View

A high-performance native SwiftUI profile view component for React Native (iOS only).

## Overview

This module provides a native iOS profile view with:

- **Profile Header**: Avatar, display name, handle, bio, follower/following counts, and action buttons
- **Tab Switching**: Native tabs for Posts, Replies, Media, and Likes
- **Follow/Unfollow Actions**: Bridged back to React Native for handling
- **Own Profile Support**: Shows "Edit Profile" button for the current user's profile
- **Smooth Animations**: Native SwiftUI animations for a polished feel

## Architecture

The module is designed to work with the existing `NativeFeedList` component:

- `ProfileView` renders the header and tab bar
- The feed content is rendered by `NativeFeedList` (passed from React Native)
- Profile data is passed via `ProfileBridge` module (similar to `FeedBridge`)

## Components

### Swift Components

- **ProfileHeaderView**: SwiftUI component for the profile header
- **ProfileView**: Main view with header and tab bar
- **ProfileBridgeModule**: Bridge for passing profile data from React Native
- **ProfileViewModule**: Expo module wrapper

### React Native Components

- **NativeProfileView**: Low-level native view wrapper
- **NativeProfileViewWithData**: High-level component with data bridge

## Usage

### Basic Usage

```typescript
import { NativeProfileViewWithData } from 'native-profile-view';
import type { ProfileData } from 'native-profile-view';

function ProfileScreen({ handle }: { handle: string }) {
  const { data: profile, isLoading, error } = useProfile(handle);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  return (
    <NativeProfileViewWithData
      profile={profile}
      isLoading={isLoading}
      error={error}
      isOwnProfile={account?.handle === handle}
      onTabChange={(event) => {
        setActiveTab(event.nativeEvent.tab);
      }}
      onFollowToggle={() => {
        // Handle follow/unfollow
      }}
      onMessagePress={() => {
        // Navigate to messages
      }}
      onFollowersPress={() => {
        // Navigate to followers list
      }}
      onFollowingPress={() => {
        // Navigate to following list
      }}
      onEditProfile={() => {
        // Navigate to edit profile screen
      }}
    />
  );
}
```

### With NativeFeedList

```typescript
import { NativeProfileViewWithData } from 'native-profile-view';
import { NativeFeedList } from 'native-feed-list';

function ProfileScreen({ handle }: { handle: string }) {
  const { data: profile } = useProfile(handle);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  // Get feed based on active tab
  const feedQuery = useAuthorFeed(handle, getFilter(activeTab));

  return (
    <View style={{ flex: 1 }}>
      {/* Profile header and tabs */}
      <NativeProfileViewWithData
        profile={profile}
        isOwnProfile={account?.handle === handle}
        onTabChange={(event) => setActiveTab(event.nativeEvent.tab)}
        // ... other handlers
      />

      {/* Feed content */}
      <NativeFeedList
        query={feedQuery}
        onPostPress={(event) => {
          // Handle post press
        }}
        // ... other handlers
      />
    </View>
  );
}
```

## Props

### NativeProfileViewWithData

- `profile: ProfileData | null` - The profile data to display
- `isLoading?: boolean` - Whether the profile is loading
- `error?: Error | null` - Error if profile failed to load
- `isOwnProfile?: boolean` - Whether this is the current user's profile
- `onRefresh?: () => void` - Called when pull-to-refresh is triggered
- `onTabChange?: (event) => void` - Called when tab is changed
- `onFollowToggle?: () => void` - Called when follow/unfollow button is pressed
- `onMessagePress?: () => void` - Called when message button is pressed
- `onMenuPress?: () => void` - Called when menu button is pressed
- `onFollowersPress?: () => void` - Called when followers count is pressed
- `onFollowingPress?: () => void` - Called when following count is pressed
- `onEditProfile?: () => void` - Called when Edit Profile button is pressed (own profile only)

## Profile Data Type

```typescript
interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  viewer?: ProfileViewer;
}

interface ProfileViewer {
  muted?: boolean;
  blockedBy?: boolean;
  blocking?: string;
  following?: string;
  followedBy?: string;
}
```

## Tab Types

```typescript
type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';
```

## Platform Support

- **iOS**: Native SwiftUI implementation (iOS 15+)
- **Android**: Not supported yet (returns null)

## Dependencies

- expo-modules-core
- FeedBridge module (for feed data)
- NativeFeedList module (for feed rendering)

## Development

The module uses Expo's native modules system with autolinking. Swift files are located in `ios/` directory.

## Notes

- This module provides the profile **header and tab switching only**
- The feed content should be rendered separately using `NativeFeedList`
- Profile data is passed via `ProfileBridge` module using notifications
- All user interactions are bridged back to React Native for handling
