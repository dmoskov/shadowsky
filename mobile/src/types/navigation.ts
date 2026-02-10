import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {DrawerScreenProps} from '@react-navigation/drawer';

/**
 * Root Stack Navigator - handles auth flow and main app
 */
export type RootStackParamList = {
  // Auth flow screens
  Landing: undefined;
  OAuthCallback: {
    code?: string;
    state?: string;
    error?: string;
    iss?: string;
  };

  // Main app entry (contains drawer + tabs)
  Main: NavigatorScreenParams<DrawerParamList>;
};

/**
 * Drawer Navigator - side menu navigation
 */
export type DrawerParamList = {
  // Main content area with tabs
  Tabs: NavigatorScreenParams<TabParamList>;

  // Drawer-only screens
  Settings: {section?: string};
  Analytics: undefined;
  ScheduledPosts: undefined;
  Lists: undefined;
};

/**
 * Tab Navigator - bottom tab bar navigation
 * Maps to main web routes
 */
export type TabParamList = {
  // Home stack
  HomeStack: NavigatorScreenParams<HomeStackParamList>;

  // Search stack
  SearchStack: NavigatorScreenParams<SearchStackParamList>;

  // Compose (opens modal)
  Compose: undefined;

  // Notifications stack
  NotificationsStack: NavigatorScreenParams<NotificationsStackParamList>;

  // Profile stack
  ProfileStack: NavigatorScreenParams<ProfileStackParamList>;
};

/**
 * Home Stack - feed and related screens
 */
export type HomeStackParamList = {
  Home: undefined;
  Timeline: undefined;
  Thread: {handle: string; postId: string};
  Profile: {handle: string};
  ListTimeline: {listId: string};
};

/**
 * Search Stack - search and discovery
 */
export type SearchStackParamList = {
  Search: {query?: string};
  Profile: {handle: string};
  Thread: {handle: string; postId: string};
};

/**
 * Notifications Stack
 */
export type NotificationsStackParamList = {
  Notifications: undefined;
  NotificationsAnalytics: undefined;
  Thread: {handle: string; postId: string};
  Profile: {handle: string};
};

/**
 * Profile Stack - user profile and related
 */
export type ProfileStackParamList = {
  MyProfile: undefined;
  Profile: {handle: string};
  Thread: {handle: string; postId: string};
  Bookmarks: undefined;
  Messages: undefined;
};

/**
 * Composite screen props for nested navigators
 */

// Root stack screen props
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Drawer screen props with root stack context
export type DrawerScreenPropsType<T extends keyof DrawerParamList> =
  CompositeScreenProps<
    DrawerScreenProps<DrawerParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Tab screen props with drawer context
export type TabScreenPropsType<T extends keyof TabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList, T>,
    DrawerScreenPropsType<keyof DrawerParamList>
  >;

// Home stack screen props with full context
export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    TabScreenPropsType<keyof TabParamList>
  >;

// Search stack screen props
export type SearchStackScreenProps<T extends keyof SearchStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SearchStackParamList, T>,
    TabScreenPropsType<keyof TabParamList>
  >;

// Notifications stack screen props
export type NotificationsStackScreenProps<
  T extends keyof NotificationsStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<NotificationsStackParamList, T>,
  TabScreenPropsType<keyof TabParamList>
>;

// Profile stack screen props
export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    TabScreenPropsType<keyof TabParamList>
  >;

/**
 * Declare global type augmentation for useNavigation hook
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
