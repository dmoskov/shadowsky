import {useNavigation as useRNNavigation, useRoute} from '@react-navigation/native';
import {useCallback} from 'react';
import type {
  RootStackParamList,
  DrawerParamList,
  TabParamList,
  HomeStackParamList,
} from '../types/navigation';

/**
 * Custom navigation hook with typed helpers
 */
export function useAppNavigation() {
  const navigation = useRNNavigation();

  // Navigate to a profile
  const navigateToProfile = useCallback(
    (handle: string) => {
      // @ts-expect-error - nested navigation
      navigation.navigate('Main', {
        screen: 'Tabs',
        params: {
          screen: 'HomeStack',
          params: {
            screen: 'Profile',
            params: {handle},
          },
        },
      });
    },
    [navigation],
  );

  // Navigate to a thread
  const navigateToThread = useCallback(
    (handle: string, postId: string) => {
      // @ts-expect-error - nested navigation
      navigation.navigate('Main', {
        screen: 'Tabs',
        params: {
          screen: 'HomeStack',
          params: {
            screen: 'Thread',
            params: {handle, postId},
          },
        },
      });
    },
    [navigation],
  );

  // Navigate to search
  const navigateToSearch = useCallback(
    (query?: string) => {
      // @ts-expect-error - nested navigation
      navigation.navigate('Main', {
        screen: 'Tabs',
        params: {
          screen: 'SearchStack',
          params: {
            screen: 'Search',
            params: query ? {query} : undefined,
          },
        },
      });
    },
    [navigation],
  );

  // Navigate to compose
  const navigateToCompose = useCallback(() => {
    // @ts-expect-error - nested navigation
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: {
        screen: 'Compose',
      },
    });
  }, [navigation]);

  // Navigate to settings
  const navigateToSettings = useCallback(
    (section?: string) => {
      // @ts-expect-error - nested navigation
      navigation.navigate('Main', {
        screen: 'Settings',
        params: section ? {section} : undefined,
      });
    },
    [navigation],
  );

  // Navigate to home
  const navigateToHome = useCallback(() => {
    // @ts-expect-error - nested navigation
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: {
        screen: 'HomeStack',
        params: {
          screen: 'Home',
        },
      },
    });
  }, [navigation]);

  // Navigate to notifications
  const navigateToNotifications = useCallback(() => {
    // @ts-expect-error - nested navigation
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: {
        screen: 'NotificationsStack',
        params: {
          screen: 'Notifications',
        },
      },
    });
  }, [navigation]);

  // Navigate to bookmarks
  const navigateToBookmarks = useCallback(() => {
    // @ts-expect-error - nested navigation
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: {
        screen: 'ProfileStack',
        params: {
          screen: 'Bookmarks',
        },
      },
    });
  }, [navigation]);

  // Navigate to messages
  const navigateToMessages = useCallback(() => {
    // @ts-expect-error - nested navigation
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: {
        screen: 'ProfileStack',
        params: {
          screen: 'Messages',
        },
      },
    });
  }, [navigation]);

  // Navigate to a list timeline
  const navigateToList = useCallback(
    (listId: string) => {
      // @ts-expect-error - nested navigation
      navigation.navigate('Main', {
        screen: 'Tabs',
        params: {
          screen: 'HomeStack',
          params: {
            screen: 'ListTimeline',
            params: {listId},
          },
        },
      });
    },
    [navigation],
  );

  // Open drawer
  const openDrawer = useCallback(() => {
    // @ts-expect-error - drawer navigation
    navigation.openDrawer?.();
  }, [navigation]);

  // Close drawer
  const closeDrawer = useCallback(() => {
    // @ts-expect-error - drawer navigation
    navigation.closeDrawer?.();
  }, [navigation]);

  return {
    navigation,
    navigateToProfile,
    navigateToThread,
    navigateToSearch,
    navigateToCompose,
    navigateToSettings,
    navigateToHome,
    navigateToNotifications,
    navigateToBookmarks,
    navigateToMessages,
    navigateToList,
    openDrawer,
    closeDrawer,
  };
}

/**
 * Hook to extract route params with type safety
 */
export function useRouteParams<T extends Record<string, unknown>>(): T {
  const route = useRoute();
  return (route.params as T) ?? ({} as T);
}
