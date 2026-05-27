import type { LucideIcon } from "lucide-react";

export type FeedType =
  | "following"
  | "whats-hot"
  | "popular-with-friends"
  | "recent"
  | string;

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
  initialFeedUri?: string;
  isFocused?: boolean;
  columnId?: string;
  onClose?: () => void;
  onFeedChange?: (
    feed: string,
    label: string,
    feedOptions: FeedOption[],
  ) => void;
  onRefreshRequest?: number;
  showFeedDiscovery?: boolean;
  onCloseFeedDiscovery?: () => void;
}
