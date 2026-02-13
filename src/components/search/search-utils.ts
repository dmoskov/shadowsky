import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  type AppBskyFeedDefs,
} from "@atproto/api";
import type {
  SearchFilters as FacetedSearchFilters,
  MediaType,
} from "../../hooks/useSearch";

export type SearchTab = "posts" | "users" | "feeds";

export interface SearchFilters {
  query: string;
  phrases: string[];
  hashtags: string[];
  from: string[];
  mentions: string[];
  domains: string[];
  language: string;
  sinceDate: string;
  untilDate: string;
  hasMedia: boolean;
}

export interface UserSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  interactionScore?: number;
}

export interface SavedSearch {
  id: string;
  query: string;
  createdAt: number;
}

// Check if a post has media attachments
export const postHasMedia = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;

  const embed = post.embed;

  // Direct image embed
  if (AppBskyEmbedImages.isView(embed)) {
    return true;
  }

  // Record with media (quote post with images)
  if (
    AppBskyEmbedRecordWithMedia.isView(embed) &&
    AppBskyEmbedImages.isView(embed.media)
  ) {
    return true;
  }

  // Video embed
  if (AppBskyEmbedVideo.isView(embed)) {
    return true;
  }

  return false;
};

// Check if a post has images specifically
export const postHasImages = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;
  const embed = post.embed;

  if (AppBskyEmbedImages.isView(embed)) {
    return true;
  }

  if (
    AppBskyEmbedRecordWithMedia.isView(embed) &&
    AppBskyEmbedImages.isView(embed.media)
  ) {
    return true;
  }

  return false;
};

// Check if a post has videos specifically
export const postHasVideo = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;
  return AppBskyEmbedVideo.isView(post.embed);
};

// Check if a post has external links
export const postHasLinks = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;
  const embed = post.embed;

  if (AppBskyEmbedExternal.isView(embed)) {
    return true;
  }

  if (
    AppBskyEmbedRecordWithMedia.isView(embed) &&
    AppBskyEmbedExternal.isView(embed.media)
  ) {
    return true;
  }

  return false;
};

// Check if a post is text-only (no embeds)
export const postIsTextOnly = (post: AppBskyFeedDefs.PostView): boolean => {
  return !post.embed;
};

// Check if post meets engagement thresholds
export const postMeetsEngagement = (
  post: AppBskyFeedDefs.PostView,
  thresholds: { minLikes: number; minReposts: number; minReplies: number },
): boolean => {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;

  return (
    likes >= thresholds.minLikes &&
    reposts >= thresholds.minReposts &&
    replies >= thresholds.minReplies
  );
};

// Filter posts by media type
export const filterByMediaType = (
  posts: AppBskyFeedDefs.PostView[],
  mediaType: MediaType,
): AppBskyFeedDefs.PostView[] => {
  if (mediaType === "all") return posts;

  switch (mediaType) {
    case "images":
      return posts.filter(postHasImages);
    case "videos":
      return posts.filter(postHasVideo);
    case "links":
      return posts.filter(postHasLinks);
    case "text-only":
      return posts.filter(postIsTextOnly);
    default:
      return posts;
  }
};

// Parse faceted filters from URL search params
export const parseFacetedFiltersFromParams = (
  searchParams: URLSearchParams,
): Partial<FacetedSearchFilters> => {
  const filters: Partial<FacetedSearchFilters> = {};

  const mediaType = searchParams.get("mediaType");
  if (
    mediaType &&
    ["all", "images", "videos", "links", "text-only"].includes(mediaType)
  ) {
    filters.mediaType = mediaType as MediaType;
  }

  const sinceDate = searchParams.get("since");
  if (sinceDate) filters.sinceDate = sinceDate;

  const untilDate = searchParams.get("until");
  if (untilDate) filters.untilDate = untilDate;

  const datePreset = searchParams.get("datePreset");
  if (
    datePreset &&
    ["today", "week", "month", "year", "custom"].includes(datePreset)
  ) {
    filters.datePreset = datePreset as FacetedSearchFilters["datePreset"];
  }

  const minLikes = searchParams.get("minLikes");
  const minReposts = searchParams.get("minReposts");
  const minReplies = searchParams.get("minReplies");
  if (minLikes || minReposts || minReplies) {
    filters.engagement = {
      minLikes: minLikes ? parseInt(minLikes, 10) : 0,
      minReposts: minReposts ? parseInt(minReposts, 10) : 0,
      minReplies: minReplies ? parseInt(minReplies, 10) : 0,
    };
  }

  const language = searchParams.get("lang");
  if (language) filters.language = language;

  const fromUsers = searchParams.get("from");
  if (fromUsers) filters.fromUsers = fromUsers.split(",");

  return filters;
};

// Serialize faceted filters to URL search params
export const serializeFacetedFiltersToParams = (
  filters: FacetedSearchFilters,
): Record<string, string> => {
  const params: Record<string, string> = {};

  if (filters.mediaType !== "all") {
    params.mediaType = filters.mediaType;
  }

  if (filters.sinceDate) params.since = filters.sinceDate;
  if (filters.untilDate) params.until = filters.untilDate;
  if (filters.datePreset) params.datePreset = filters.datePreset;

  if (filters.engagement.minLikes > 0) {
    params.minLikes = filters.engagement.minLikes.toString();
  }
  if (filters.engagement.minReposts > 0) {
    params.minReposts = filters.engagement.minReposts.toString();
  }
  if (filters.engagement.minReplies > 0) {
    params.minReplies = filters.engagement.minReplies.toString();
  }

  if (filters.language) params.lang = filters.language;
  if (filters.fromUsers.length > 0) params.from = filters.fromUsers.join(",");

  return params;
};

// Extract images from a post
export const getPostImages = (
  post: AppBskyFeedDefs.PostView,
): Array<{ thumb: string; fullsize: string; alt?: string }> => {
  if (!post.embed) return [];

  const embed = post.embed as any;
  let images: Array<{ thumb: string; fullsize: string; alt?: string }> = [];

  // Extract images from different embed types
  if (embed.$type === "app.bsky.embed.images#view" && embed.images) {
    images = embed.images;
  } else if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    embed.media?.$type === "app.bsky.embed.images#view" &&
    embed.media.images
  ) {
    images = embed.media.images;
  }

  return images;
};

// Build search query from filters
export const buildSearchQuery = (searchFilters: SearchFilters) => {
  const parts: string[] = [];

  // Basic query
  if (searchFilters.query) {
    parts.push(searchFilters.query);
  }

  // Exact phrases
  searchFilters.phrases.forEach((phrase) => {
    if (phrase.trim()) {
      parts.push(`"${phrase.trim()}"`);
    }
  });

  // Hashtags
  searchFilters.hashtags.forEach((tag) => {
    if (tag.trim()) {
      parts.push(`#${tag.trim().replace(/^#/, "")}`);
    }
  });

  // From users
  searchFilters.from.forEach((user) => {
    if (user.trim()) {
      parts.push(`from:${user.trim().replace(/^@/, "")}`);
    }
  });

  // Mentions
  searchFilters.mentions.forEach((user) => {
    if (user.trim()) {
      const cleanUser = user.trim().replace(/^@/, "");
      if (cleanUser === "me") {
        parts.push("mentions:me");
      } else {
        parts.push(`@${cleanUser}`);
      }
    }
  });

  // Domains
  searchFilters.domains.forEach((domain) => {
    if (domain.trim()) {
      parts.push(`domain:${domain.trim()}`);
    }
  });

  // Language
  if (searchFilters.language) {
    parts.push(`lang:${searchFilters.language}`);
  }

  // Date range
  if (searchFilters.sinceDate) {
    parts.push(`since:${searchFilters.sinceDate}`);
  }

  if (searchFilters.untilDate) {
    parts.push(`until:${searchFilters.untilDate}`);
  }

  return parts.join(" ");
};
