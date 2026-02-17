/**
 * Spotlight Search Service
 *
 * Manages indexing of profiles and posts in iOS Spotlight (CoreSpotlight).
 * When users view profiles or posts, items are indexed so they appear
 * in the iOS home screen search. Tapping a result deep links back into the app.
 *
 * Limits indexed items to ~500 most recent to avoid storage bloat.
 */

import { Platform } from "react-native";
import {
  indexProfile as nativeIndexProfile,
  indexPost as nativeIndexPost,
  removeAllItems as nativeRemoveAllItems,
  isAvailable as nativeIsAvailable,
} from "../../modules/spotlight-search";
import type {
  SpotlightProfile,
  SpotlightPost,
} from "../../modules/spotlight-search";

/**
 * Check if Spotlight search indexing is available.
 * Only available on iOS with CoreSpotlight support.
 */
export function isSpotlightAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  return nativeIsAvailable();
}

/**
 * Index a profile for Spotlight search.
 * Call this when a user views a profile.
 */
export function indexProfileForSpotlight(profile: {
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  did: string;
}): void {
  if (!isSpotlightAvailable()) return;

  const data: SpotlightProfile = {
    handle: profile.handle,
    displayName: profile.displayName,
    description: profile.description,
    avatarUrl: profile.avatar,
    did: profile.did,
  };

  nativeIndexProfile(data);
}

/**
 * Index a post for Spotlight search.
 * Call this when a user views a post/thread.
 */
export function indexPostForSpotlight(post: {
  uri: string;
  text: string;
  authorHandle: string;
  authorName?: string;
  authorAvatar?: string;
}): void {
  if (!isSpotlightAvailable()) return;

  // Extract the rkey from the AT URI (at://did/app.bsky.feed.post/rkey)
  const parts = post.uri.split("/");
  const rkey = parts[parts.length - 1];

  if (!rkey) return;

  const data: SpotlightPost = {
    uri: post.uri,
    text: post.text.substring(0, 300), // Limit description length
    authorHandle: post.authorHandle,
    authorName: post.authorName,
    avatarUrl: post.authorAvatar,
    rkey,
  };

  nativeIndexPost(data);
}

/**
 * Clear all Spotlight search index entries for this app.
 * Useful for logout or user request.
 */
export function clearSpotlightIndex(): void {
  if (!isSpotlightAvailable()) return;
  nativeRemoveAllItems();
}
