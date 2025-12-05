/**
 * Navigation exports
 *
 * The navigation architecture is structured as follows:
 *
 * RootNavigator (handles auth state)
 * ├── Landing (unauthenticated)
 * ├── OAuthCallback (auth flow)
 * └── Main -> DrawerNavigator (authenticated)
 *     ├── Tabs -> TabNavigator
 *     │   ├── HomeStack
 *     │   │   ├── Home
 *     │   │   ├── Timeline
 *     │   │   ├── Thread
 *     │   │   ├── Profile
 *     │   │   └── ListTimeline
 *     │   ├── SearchStack
 *     │   │   ├── Search
 *     │   │   ├── Thread
 *     │   │   └── Profile
 *     │   ├── Compose (modal)
 *     │   ├── NotificationsStack
 *     │   │   ├── Notifications
 *     │   │   ├── NotificationsAnalytics
 *     │   │   ├── Thread
 *     │   │   └── Profile
 *     │   └── ProfileStack
 *     │       ├── MyProfile
 *     │       ├── Profile
 *     │       ├── Thread
 *     │       ├── Bookmarks
 *     │       └── Messages
 *     ├── Settings
 *     ├── Analytics
 *     ├── ScheduledPosts
 *     └── Lists
 */

export {RootNavigator} from './RootNavigator';
export {DrawerNavigator} from './DrawerNavigator';
export {TabNavigator} from './TabNavigator';
export {HomeStack} from './stacks/HomeStack';
export {SearchStack} from './stacks/SearchStack';
export {NotificationsStack} from './stacks/NotificationsStack';
export {ProfileStack} from './stacks/ProfileStack';
export {linking, buildDeepLink, buildProfileLink, buildThreadLink, buildSearchLink} from './linking';
