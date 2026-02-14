/**
 * In-app browser utilities
 * Uses Safari View Controller (iOS) and Chrome Custom Tabs (Android) for in-app browsing
 */

import * as WebBrowser from 'expo-web-browser';
import {router} from 'expo-router';
import {colors} from '../constants/theme';


import { createLogger } from '../utils/logger';

const logger = createLogger('Browser');
/**
 * Check if a URL is a Bluesky deep link that should be handled in-app
 * rather than opening in the in-app browser
 */
function isBskyDeepLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if it's a bsky.app URL
    return urlObj.hostname === 'bsky.app' || urlObj.hostname === 'www.bsky.app';
  } catch {
    return false;
  }
}

/**
 * Navigate to a Bluesky deep link within the app
 * Parses bsky.app URLs and navigates to the appropriate screen
 * @param url - The bsky.app URL to navigate to
 * @returns true if navigation was handled, false otherwise
 */
function handleBskyDeepLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Profile links: /profile/[handle]
    const profileMatch = pathname.match(/^\/profile\/([^/]+)$/);
    if (profileMatch) {
      const handle = profileMatch[1];
      router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
      return true;
    }

    // Post/thread links: /profile/[handle]/post/[postId]
    const postMatch = pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)$/);
    if (postMatch) {
      const [, handle, postId] = postMatch;
      router.push(`/(app)/(tabs)/(home)/thread/${postId}?handle=${handle}`);
      return true;
    }

    // Search: /search?q=query
    if (pathname === '/search') {
      const query = urlObj.searchParams.get('q');
      if (query) {
        router.push(`/(app)/(tabs)/(search)?query=${encodeURIComponent(query)}`);
      } else {
        router.push('/(app)/(tabs)/(search)');
      }
      return true;
    }

    // List: /lists/[listUri]
    const listMatch = pathname.match(/^\/lists\/(.+)$/);
    if (listMatch) {
      const listUri = decodeURIComponent(listMatch[1]);
      router.push(`/(app)/(tabs)/(home)/list/${encodeURIComponent(listUri)}`);
      return true;
    }

    // If we can't parse the URL, return false to open in browser
    return false;
  } catch (error) {
    logger.error('Failed to parse bsky.app deep link:', error);
    return false;
  }
}

/**
 * Open a URL in the in-app browser
 * Uses SFSafariViewController on iOS and Chrome Custom Tabs on Android
 *
 * @param url - The URL to open
 * @returns Promise that resolves when the browser is dismissed
 */
export async function openLink(url: string): Promise<void> {
  try {
    // For bsky.app URLs, try to handle them as deep links within the app
    if (isBskyDeepLink(url)) {
      const handled = handleBskyDeepLink(url);
      if (handled) {
        // Successfully navigated within app, no need to open browser
        return;
      }
      // If we couldn't parse the URL, fall through to open in browser
    }

    // Open the URL in an in-app browser
    await WebBrowser.openBrowserAsync(url, {
      // Toolbar color matching app dark theme
      toolbarColor: colors.background, // #0a0a0f
      // Control tint color (buttons, etc.)
      controlsColor: colors.primary, // #c9a84c
      // Collapse the toolbar when scrolling (iOS only)
      enableBarCollapsing: true,
      // Show the page title in the toolbar
      showTitle: true,
      // Dismiss button style
      dismissButtonStyle: 'close',
      // Presentation style (iOS only)
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch (error) {
    logger.error('Failed to open URL in browser:', error);
    throw error;
  }
}

/**
 * Check if a URL can be opened
 * @param url - The URL to check
 * @returns Promise that resolves to true if the URL can be opened
 */
export async function canOpenURL(url: string): Promise<boolean> {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
