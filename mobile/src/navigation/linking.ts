import type {LinkingOptions} from '@react-navigation/native';
import {Linking} from 'react-native';
import type {RootStackParamList} from '../types/navigation';

/**
 * Deep linking configuration for bsky:// and https:// URLs
 *
 * Supported URL patterns:
 * - bsky://home -> Home tab
 * - bsky://search?q=query -> Search with query
 * - bsky://notifications -> Notifications tab
 * - bsky://profile/handle.bsky.social -> Profile screen
 * - bsky://thread/handle.bsky.social/postId -> Thread screen
 * - bsky://compose -> Compose screen
 * - bsky://settings -> Settings screen
 * - bsky://settings/appearance -> Settings with section
 * - bsky://bookmarks -> Bookmarks screen
 * - bsky://messages -> Messages screen
 * - bsky://lists -> Lists screen
 * - bsky://lists/listId -> List timeline
 *
 * Also handles:
 * - https://bsky.app/profile/handle -> Profile
 * - https://bsky.app/profile/handle/post/postId -> Thread
 * - https://shadowsky.io/* -> Same as bsky://
 */

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'bsky://',
    'shadowsky://',
    'https://bsky.app',
    'https://staging.bsky.app',
    'https://shadowsky.io',
    'https://main.shadowsky.io',
  ],

  config: {
    screens: {
      // Auth screens
      Landing: 'login',
      OAuthCallback: {
        path: 'oauth/callback',
        parse: {
          code: (code: string) => code,
          state: (state: string) => state,
          error: (error: string) => error,
        },
      },

      // Main app navigator
      Main: {
        screens: {
          // Drawer screens
          Tabs: {
            screens: {
              // Home tab stack
              HomeStack: {
                screens: {
                  Home: {
                    path: 'home',
                    exact: true,
                  },
                  Timeline: 'timeline',
                  Thread: {
                    path: 'profile/:handle/post/:postId',
                    parse: {
                      handle: (handle: string) => handle,
                      postId: (postId: string) => postId,
                    },
                  },
                  Profile: {
                    path: 'profile/:handle',
                    parse: {
                      handle: (handle: string) => handle,
                    },
                  },
                  ListTimeline: {
                    path: 'lists/:listId',
                    parse: {
                      listId: (listId: string) => listId,
                    },
                  },
                },
              },

              // Search tab stack
              SearchStack: {
                screens: {
                  Search: {
                    path: 'search',
                    parse: {
                      query: (q: string) => q,
                    },
                  },
                },
              },

              // Compose (modal)
              Compose: 'compose',

              // Notifications tab stack
              NotificationsStack: {
                screens: {
                  Notifications: 'notifications',
                  NotificationsAnalytics: 'analytics/notifications',
                },
              },

              // Profile tab stack
              ProfileStack: {
                screens: {
                  MyProfile: 'me',
                  Bookmarks: 'bookmarks',
                  Messages: 'messages',
                },
              },
            },
          },

          // Drawer-only screens
          Settings: {
            path: 'settings/:section?',
            parse: {
              section: (section: string) => section,
            },
          },
          Analytics: 'analytics',
          ScheduledPosts: 'scheduled',
          Lists: {
            path: 'lists',
            exact: true,
          },
        },
      },
    },
  },

  // Custom URL handler for OAuth callbacks and external links
  async getInitialURL() {
    // Check if app was opened via deep link
    const url = await Linking.getInitialURL();

    if (url !== null) {
      return url;
    }

    return null;
  },

  // Subscribe to incoming deep links
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({url}) => {
      listener(url);
    });

    return () => {
      subscription.remove();
    };
  },
};

/**
 * Helper function to build deep link URLs
 */
export function buildDeepLink(
  path: string,
  params?: Record<string, string>,
): string {
  let url = `bsky://${path}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Navigate to a profile via deep link
 */
export function buildProfileLink(handle: string): string {
  return buildDeepLink(`profile/${handle}`);
}

/**
 * Navigate to a thread via deep link
 */
export function buildThreadLink(handle: string, postId: string): string {
  return buildDeepLink(`profile/${handle}/post/${postId}`);
}

/**
 * Navigate to search with a query
 */
export function buildSearchLink(query?: string): string {
  return query ? buildDeepLink('search', {q: query}) : buildDeepLink('search');
}
