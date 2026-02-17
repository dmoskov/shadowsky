/**
 * Hook for indexing content in iOS Spotlight search.
 *
 * Automatically indexes profiles and posts when they are viewed,
 * making them searchable from the iOS home screen.
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  indexProfileForSpotlight,
  indexPostForSpotlight,
} from "../services/spotlight-search";

/**
 * Index a profile in Spotlight when viewed.
 * Debounces to avoid re-indexing the same profile on rapid re-renders.
 */
export function useSpotlightProfile(profile: {
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  did: string;
} | null | undefined): void {
  const lastIndexed = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!profile?.handle || !profile?.did) return;

    // Skip if we already indexed this profile in this session
    if (lastIndexed.current === profile.handle) return;
    lastIndexed.current = profile.handle;

    indexProfileForSpotlight({
      handle: profile.handle,
      displayName: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      did: profile.did,
    });
  }, [profile?.handle, profile?.did, profile?.displayName, profile?.description, profile?.avatar]);
}

/**
 * Index a post in Spotlight when viewed in a thread.
 * Debounces to avoid re-indexing the same post on rapid re-renders.
 */
export function useSpotlightPost(post: {
  uri: string;
  text: string;
  authorHandle: string;
  authorName?: string;
  authorAvatar?: string;
} | null | undefined): void {
  const lastIndexed = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!post?.uri || !post?.authorHandle) return;

    // Skip if we already indexed this post in this session
    if (lastIndexed.current === post.uri) return;
    lastIndexed.current = post.uri;

    indexPostForSpotlight({
      uri: post.uri,
      text: post.text,
      authorHandle: post.authorHandle,
      authorName: post.authorName,
      authorAvatar: post.authorAvatar,
    });
  }, [post?.uri, post?.text, post?.authorHandle, post?.authorName, post?.authorAvatar]);
}
