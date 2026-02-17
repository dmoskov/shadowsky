import { Platform } from "react-native";

let SpotlightSearchModule: {
  isAvailable(): boolean;
  indexProfile(data: Record<string, string>): void;
  indexPost(data: Record<string, string>): void;
  removeItem(identifier: string): void;
  removeAllItems(): void;
  getIndexedCount(): number;
} | null = null;

try {
  SpotlightSearchModule =
    require("expo-modules-core").requireNativeModule("SpotlightSearch");
} catch {
  // Module not available (web or not built with native modules)
}

export interface SpotlightProfile {
  handle: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  did: string;
}

export interface SpotlightPost {
  uri: string;
  text: string;
  authorHandle: string;
  authorName?: string;
  avatarUrl?: string;
  rkey: string;
}

/**
 * Check if Spotlight indexing is available on this device.
 */
export function isAvailable(): boolean {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return false;
  }
  try {
    return SpotlightSearchModule.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Index a profile in iOS Spotlight search.
 * When a user views a profile, call this to make it searchable from the home screen.
 */
export function indexProfile(profile: SpotlightProfile): void {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return;
  }
  try {
    SpotlightSearchModule.indexProfile({
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      description: profile.description || "",
      avatarUrl: profile.avatarUrl || "",
      did: profile.did,
    });
  } catch {
    // Silently ignore indexing failures
  }
}

/**
 * Index a post in iOS Spotlight search.
 * When a user views a post/thread, call this to make it searchable from the home screen.
 */
export function indexPost(post: SpotlightPost): void {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return;
  }
  try {
    SpotlightSearchModule.indexPost({
      uri: post.uri,
      text: post.text,
      authorHandle: post.authorHandle,
      authorName: post.authorName || post.authorHandle,
      avatarUrl: post.avatarUrl || "",
      rkey: post.rkey,
    });
  } catch {
    // Silently ignore indexing failures
  }
}

/**
 * Remove a specific item from the Spotlight index.
 */
export function removeItem(identifier: string): void {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return;
  }
  try {
    SpotlightSearchModule.removeItem(identifier);
  } catch {
    // Silently ignore
  }
}

/**
 * Remove all items from the Spotlight index.
 */
export function removeAllItems(): void {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return;
  }
  try {
    SpotlightSearchModule.removeAllItems();
  } catch {
    // Silently ignore
  }
}

/**
 * Get the approximate number of indexed items.
 */
export function getIndexedCount(): number {
  if (Platform.OS !== "ios" || !SpotlightSearchModule) {
    return 0;
  }
  try {
    return SpotlightSearchModule.getIndexedCount();
  } catch {
    return 0;
  }
}
