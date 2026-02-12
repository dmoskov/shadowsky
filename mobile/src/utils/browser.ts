/**
 * In-app browser utilities
 * Uses Safari View Controller (iOS) and Chrome Custom Tabs (Android) for in-app browsing
 */

import * as WebBrowser from 'expo-web-browser';
import {colors} from '../constants/theme';

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
 * Open a URL in the in-app browser
 * Uses SFSafariViewController on iOS and Chrome Custom Tabs on Android
 *
 * @param url - The URL to open
 * @returns Promise that resolves when the browser is dismissed
 */
export async function openLink(url: string): Promise<void> {
  try {
    // For bsky.app URLs, we should handle them as deep links
    // For now, we'll open them in the browser, but this can be enhanced
    // to navigate within the app if the deep link handling is implemented
    if (isBskyDeepLink(url)) {
      // TODO: Implement deep link navigation within app
      // For now, still open in browser
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
    console.error('Failed to open URL in browser:', error);
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
