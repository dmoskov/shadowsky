import type { AppBskyActorDefs } from "@atproto/api";

// Sourced from the shared workspace package (shared-logic migration).
// Re-exported here so existing importers are unaffected.
export { formatCount, formatJoinDate } from "@bsky/core";

export interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  createdAt?: string;
  indexedAt?: string;
  labels?: AppBskyActorDefs.ProfileViewDetailed["labels"];
  associated?: AppBskyActorDefs.ProfileAssociated;
  pinnedPost?: { uri: string; cid: string };
  verification?: AppBskyActorDefs.VerificationState;
  viewer?: {
    following?: string;
    followedBy?: string;
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    knownFollowers?: AppBskyActorDefs.KnownFollowers;
  };
}

export type ProfileTab = "posts" | "replies" | "media" | "likes" | "top";
