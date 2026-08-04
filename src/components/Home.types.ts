import type { LucideIcon } from "lucide-react";

export type FeedType =
  | "following"
  | "whats-hot"
  | "popular-with-friends"
  | "recent"
  | string; // Allow custom feed URIs

export interface PostRecord {
  text: string;
  createdAt: string;
  embed?: unknown;
  facets?: unknown[];
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
}

export interface Post {
  uri: string;
  cid: string;
  indexedAt?: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: PostRecord;
  embed?: Embed;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  viewer?: {
    like?: string;
    repost?: string;
  };
  reason?: {
    $type: string;
    by: {
      did: string;
      handle: string;
      displayName?: string;
    };
  };
}

export interface FeedGenerator {
  uri: string;
  cid: string;
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  displayName: string;
  description?: string;
  avatar?: string;
  likeCount?: number;
  viewer?: {
    like?: string;
  };
}

export interface FeedOption {
  type: FeedType;
  label: string;
  icon: LucideIcon;
  uri: string;
  isDefault?: boolean;
  pinned?: boolean;
  generator?: FeedGenerator;
}

export interface SavedFeed {
  value: string;
  pinned?: boolean;
  type: string;
}

export type FeedPageItem = any;

export interface FeedPage {
  feed: FeedPageItem[];
  cursor?: string;
}

export interface FeedQueryData {
  pages: FeedPage[];
  pageParams: (string | undefined)[];
}

export interface EmbedImage {
  thumb: string;
  fullsize?: string;
  alt?: string;
}

export interface EmbedExternal {
  uri?: string;
  thumb?: string;
  title?: string;
  description?: string;
}

export interface EmbedRecord {
  $type?: string;
  uri?: string;
  cid?: string;
  author?: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  value?: {
    text?: string;
    createdAt?: string;
    facets?: unknown[];
  };
  embeds?: Embed[];
  indexedAt?: string;
}

export interface Embed {
  $type?: string;
  images?: EmbedImage[];
  external?: EmbedExternal;
  record?: EmbedRecord;
  media?: Embed;
  playlist?: string;
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
  alt?: string;
  cid?: string;
}

export interface ApiError {
  message?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface HomeProps {
  /** The feed this column shows. Fixed by the deck; not switchable in-column. */
  feedUri: string;
  isFocused?: boolean;
  /**
   * False while this column has never been scrolled near. Holds off the feed
   * fetch so a deck of saved feeds doesn't request every one of them on mount.
   * Defaults to true for the single-column and routed cases.
   */
  isVisible?: boolean;
  /** Scopes keyboard-shortcut post actions to this column. */
  columnId?: string;
  onRefreshRequest?: number;
}

// Session storage key for persisting open thread across view mode changes
export const OPEN_THREAD_KEY = "shadowsky:open-thread";

// Mobile performance configuration
export const MOBILE_CONFIG = {
  // Reduce page size for mobile to improve memory usage
  PAGE_SIZE: window.innerWidth < 768 ? 20 : 30,
  // More aggressive GC for mobile
  STALE_TIME: window.innerWidth < 768 ? 15 * 60 * 1000 : 30 * 60 * 1000,
  GC_TIME: window.innerWidth < 768 ? 30 * 60 * 1000 : 60 * 60 * 1000,
  // Limit total pages in memory
  MAX_PAGES: window.innerWidth < 768 ? 5 : 10,
  // Virtual overscan for smooth scrolling
  VIRTUAL_OVERSCAN: window.innerWidth < 768 ? 3 : 5,
};
