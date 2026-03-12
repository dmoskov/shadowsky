import { AppBskyFeedDefs, AppBskyFeedDefs as FeedDefs } from "@atproto/api";
import { ATProtoEndpointType, rateLimited } from "../rate-limiter";
import { getAtProtoClient } from "./client";

export interface FeedOptions {
  limit?: number;
  cursor?: string;
}

export type AuthorFeedFilter =
  | "posts_no_replies"
  | "posts_with_replies"
  | "posts_with_media"
  | "posts_and_author_threads";

export interface AuthorFeedOptions extends FeedOptions {
  filter?: AuthorFeedFilter;
}

export interface FeedResponse {
  feed: AppBskyFeedDefs.FeedViewPost[];
  cursor?: string;
}

/**
 * Fetch the user's timeline feed
 */
export async function getTimeline(
  options: FeedOptions = {},
): Promise<FeedResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getTimeline({
      limit: options.limit || 50,
      cursor: options.cursor,
    });

    return {
      feed: response.data.feed,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Fetch a custom feed by URI
 */
export async function getFeed(
  feedUri: string,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.feed.getFeed({
      feed: feedUri,
      limit: options.limit || 50,
      cursor: options.cursor,
    });

    return {
      feed: response.data.feed,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Fetch author feed (posts from a specific user)
 */
export async function getAuthorFeed(
  actor: string,
  options: AuthorFeedOptions = {},
): Promise<FeedResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getAuthorFeed({
      actor,
      limit: options.limit || 50,
      cursor: options.cursor,
      filter: options.filter,
    });

    return {
      feed: response.data.feed,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Fetch likes for a specific user
 */
export async function getActorLikes(
  actor: string,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getActorLikes({
      actor,
      limit: options.limit || 50,
      cursor: options.cursor,
    });

    return {
      feed: response.data.feed,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Get a single post thread with replies
 */
export async function getPostThread(uri: string, depth: number = 6, parentHeight: number = 80) {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getPostThread({
      uri,
      depth,
      parentHeight,
    });

    return response.data.thread;
  }, ATProtoEndpointType.FEED);
}

export interface SearchPostsOptions extends FeedOptions {
  sort?: "top" | "latest";
  since?: string;
  until?: string;
  mentions?: string;
  author?: string;
  lang?: string;
  domain?: string;
  url?: string;
  tag?: string[];
}

/**
 * Search posts with filters
 */
export async function searchPosts(
  query: string,
  options: SearchPostsOptions = {},
): Promise<FeedResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.feed.searchPosts({
      q: query,
      limit: options.limit || 50,
      cursor: options.cursor,
      sort: options.sort,
      since: options.since,
      until: options.until,
      mentions: options.mentions,
      author: options.author,
      lang: options.lang,
      domain: options.domain,
      url: options.url,
      tag: options.tag,
    });

    return {
      feed: response.data.posts.map((post) => ({
        post,
        reply: undefined,
        reason: undefined,
        feedContext: undefined,
      })) as AppBskyFeedDefs.FeedViewPost[],
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

export interface FeedGeneratorResponse {
  feeds: FeedDefs.GeneratorView[];
  cursor?: string;
}

/**
 * Get popular feed generators
 */
export async function getPopularFeedGenerators(
  options: FeedOptions = {},
): Promise<FeedGeneratorResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      limit: options.limit || 50,
      cursor: options.cursor,
    });

    return {
      feeds: response.data.feeds,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Get suggested feed generators for the current user
 */
export async function getSuggestedFeeds(
  options: FeedOptions = {},
): Promise<FeedGeneratorResponse> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.feed.getSuggestedFeeds({
      limit: options.limit || 50,
      cursor: options.cursor,
    });

    return {
      feeds: response.data.feeds,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

/**
 * Search for feed generators by query (client-side filtering of popular feeds)
 * Note: AT Protocol doesn't have a native search endpoint for feed generators yet,
 * so we fetch popular feeds and filter them client-side
 */
export async function searchFeedGenerators(
  query: string,
  options: FeedOptions = {},
): Promise<FeedGeneratorResponse> {
  if (!query || query.trim() === "") {
    return { feeds: [], cursor: undefined };
  }

  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    // Fetch popular feeds and filter client-side
    const response = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      limit: 100, // Fetch more to have better search results
      cursor: options.cursor,
    });

    const searchLower = query.toLowerCase().trim();
    const filteredFeeds = response.data.feeds.filter((feed) => {
      const displayName = feed.displayName?.toLowerCase() || "";
      const description = feed.description?.toLowerCase() || "";
      const creatorHandle = feed.creator.handle?.toLowerCase() || "";

      return (
        displayName.includes(searchLower) ||
        description.includes(searchLower) ||
        creatorHandle.includes(searchLower)
      );
    });

    return {
      feeds: filteredFeeds,
      cursor: response.data.cursor,
    };
  }, ATProtoEndpointType.FEED);
}

interface SavedFeedItemV2 {
  id: string;
  type: string;
  value: string;
  pinned: boolean;
}

/**
 * Extract pinned feed URIs from preferences, supporting both v1 and v2 formats.
 */
function extractPinnedFeedUris(preferences: any[]): string[] {
  // Try v2 format first
  const v2Pref = preferences.find(
    (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
  ) as
    | { items?: SavedFeedItemV2[] }
    | undefined;

  if (v2Pref?.items && v2Pref.items.length > 0) {
    return v2Pref.items
      .filter((item) => item.type === "feed" && item.pinned)
      .map((item) => item.value);
  }

  // Fall back to v1 format
  const v1Pref = preferences.find(
    (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
  ) as { saved?: string[]; pinned?: string[] } | undefined;

  return v1Pref?.pinned || [];
}

/**
 * Find a v2 saved feed item by its feed URI.
 */
function findV2Item(
  preferences: any[],
  feedUri: string,
): { index: number; item: SavedFeedItemV2; prefIndex: number } | undefined {
  const prefIndex = preferences.findIndex(
    (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
  );
  if (prefIndex < 0) return undefined;

  const v2Pref = preferences[prefIndex] as { items?: SavedFeedItemV2[] };
  if (!v2Pref.items) return undefined;

  const itemIndex = v2Pref.items.findIndex(
    (item) => item.value === feedUri && item.type === "feed",
  );
  if (itemIndex < 0) return undefined;

  return { index: itemIndex, item: v2Pref.items[itemIndex], prefIndex };
}

/**
 * Get the current user's pinned feeds in pinned order.
 * These are the feeds shown in the home screen feed bar.
 */
export async function getSavedFeeds(): Promise<FeedDefs.GeneratorView[]> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    const pinnedUris = extractPinnedFeedUris(response.data.preferences);

    if (pinnedUris.length === 0) {
      return [];
    }

    // Get feed generator info for pinned feeds
    const feedsResponse = await agent.app.bsky.feed.getFeedGenerators({
      feeds: pinnedUris,
    });

    // Reorder to match pinned array order (API doesn't guarantee order)
    const feedMap = new Map(feedsResponse.data.feeds.map((f) => [f.uri, f]));
    return pinnedUris
      .map((uri) => feedMap.get(uri))
      .filter((f): f is FeedDefs.GeneratorView => f != null);
  }, ATProtoEndpointType.FEED);
}

/**
 * Save a feed to the user's preferences.
 * Supports both v2 (savedFeedsPrefV2) and v1 (savedFeedsPref) formats.
 * Saving a feed also pins it so it appears on the home feed bar.
 */
export async function saveFeed(feedUri: string): Promise<void> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = [...response.data.preferences];

    // Try v2 format first
    const v2Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
    );

    if (v2Index >= 0) {
      const v2Pref = preferences[v2Index] as { items?: SavedFeedItemV2[] };
      const items = [...(v2Pref.items || [])];

      // Already saved — nothing to do
      if (items.some((item) => item.value === feedUri && item.type === "feed")) {
        return;
      }

      items.push({
        id: `feed-${Date.now()}`,
        type: "feed",
        value: feedUri,
        pinned: true,
      });

      (preferences as Record<string, unknown>[])[v2Index] = {
        ...preferences[v2Index],
        items,
      };

      await agent.app.bsky.actor.putPreferences({ preferences });
      return;
    }

    // Fall back to v1 format
    const v1Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
    );

    let savedFeeds: string[] = [];
    let pinnedFeeds: string[] = [];

    if (v1Index >= 0) {
      const v1Pref = preferences[v1Index] as {
        saved?: string[];
        pinned?: string[];
      };
      savedFeeds = [...(v1Pref.saved || [])];
      pinnedFeeds = [...(v1Pref.pinned || [])];
    }

    if (!savedFeeds.includes(feedUri)) {
      savedFeeds.push(feedUri);
      pinnedFeeds.push(feedUri);

      if (v1Index >= 0) {
        preferences[v1Index] = {
          $type: "app.bsky.actor.defs#savedFeedsPref",
          saved: savedFeeds,
          pinned: pinnedFeeds,
        };
      } else {
        preferences.push({
          $type: "app.bsky.actor.defs#savedFeedsPref",
          saved: savedFeeds,
          pinned: pinnedFeeds,
        });
      }

      await agent.app.bsky.actor.putPreferences({ preferences });
    }
  }, ATProtoEndpointType.FEED);
}

/**
 * Remove a feed from the user's preferences.
 * Supports both v2 and v1 formats.
 */
export async function unsaveFeed(feedUri: string): Promise<void> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = [...response.data.preferences];

    // Try v2 format first
    const found = findV2Item(preferences, feedUri);
    if (found) {
      const v2Pref = preferences[found.prefIndex] as { items: SavedFeedItemV2[] };
      (preferences as Record<string, unknown>[])[found.prefIndex] = {
        ...preferences[found.prefIndex],
        items: v2Pref.items.filter((_, i) => i !== found.index),
      };

      await agent.app.bsky.actor.putPreferences({ preferences });
      return;
    }

    // Fall back to v1 format
    const v1Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
    );

    if (v1Index >= 0) {
      const v1Pref = preferences[v1Index] as {
        saved?: string[];
        pinned?: string[];
      };

      preferences[v1Index] = {
        $type: "app.bsky.actor.defs#savedFeedsPref",
        saved: (v1Pref.saved || []).filter((uri) => uri !== feedUri),
        pinned: (v1Pref.pinned || []).filter((uri) => uri !== feedUri),
      };

      await agent.app.bsky.actor.putPreferences({ preferences });
    }
  }, ATProtoEndpointType.FEED);
}

/**
 * Pin a feed to the home screen.
 * Supports both v2 and v1 formats.
 */
export async function pinFeed(feedUri: string): Promise<void> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = [...response.data.preferences];

    // Try v2 format first
    const v2Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
    );

    if (v2Index >= 0) {
      const v2Pref = preferences[v2Index] as { items?: SavedFeedItemV2[] };
      const items = [...(v2Pref.items || [])];
      const existingIndex = items.findIndex(
        (item) => item.value === feedUri && item.type === "feed",
      );

      if (existingIndex >= 0) {
        if (items[existingIndex].pinned) return; // Already pinned
        items[existingIndex] = { ...items[existingIndex], pinned: true };
      } else {
        // Feed not saved yet — save and pin
        items.push({
          id: `feed-${Date.now()}`,
          type: "feed",
          value: feedUri,
          pinned: true,
        });
      }

      (preferences as Record<string, unknown>[])[v2Index] = { ...preferences[v2Index], items };
      await agent.app.bsky.actor.putPreferences({ preferences });
      return;
    }

    // Fall back to v1 format
    const v1Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
    );

    let savedFeeds: string[] = [];
    let pinnedFeeds: string[] = [];

    if (v1Index >= 0) {
      const v1Pref = preferences[v1Index] as {
        saved?: string[];
        pinned?: string[];
      };
      savedFeeds = [...(v1Pref.saved || [])];
      pinnedFeeds = [...(v1Pref.pinned || [])];
    }

    if (!pinnedFeeds.includes(feedUri)) {
      pinnedFeeds.push(feedUri);
      if (!savedFeeds.includes(feedUri)) {
        savedFeeds.push(feedUri);
      }

      if (v1Index >= 0) {
        preferences[v1Index] = {
          $type: "app.bsky.actor.defs#savedFeedsPref",
          saved: savedFeeds,
          pinned: pinnedFeeds,
        };
      } else {
        preferences.push({
          $type: "app.bsky.actor.defs#savedFeedsPref",
          saved: savedFeeds,
          pinned: pinnedFeeds,
        });
      }

      await agent.app.bsky.actor.putPreferences({ preferences });
    }
  }, ATProtoEndpointType.FEED);
}

/**
 * Unpin a feed from the home screen.
 * Supports both v2 and v1 formats.
 */
export async function unpinFeed(feedUri: string): Promise<void> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = [...response.data.preferences];

    // Try v2 format first
    const found = findV2Item(preferences, feedUri);
    if (found) {
      if (!found.item.pinned) return; // Already unpinned
      const v2Pref = preferences[found.prefIndex] as { items: SavedFeedItemV2[] };
      const items = [...v2Pref.items];
      items[found.index] = { ...found.item, pinned: false };

      (preferences as Record<string, unknown>[])[found.prefIndex] = { ...preferences[found.prefIndex], items };
      await agent.app.bsky.actor.putPreferences({ preferences });
      return;
    }

    // Fall back to v1 format
    const v1Index = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
    );

    if (v1Index >= 0) {
      const v1Pref = preferences[v1Index] as {
        saved?: string[];
        pinned?: string[];
      };

      preferences[v1Index] = {
        $type: "app.bsky.actor.defs#savedFeedsPref",
        saved: v1Pref.saved || [],
        pinned: (v1Pref.pinned || []).filter((uri) => uri !== feedUri),
      };

      await agent.app.bsky.actor.putPreferences({ preferences });
    }
  }, ATProtoEndpointType.FEED);
}

/**
 * Get the pinned feeds for the current user
 */
export async function getPinnedFeeds(): Promise<string[]> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.actor.getPreferences();
    return extractPinnedFeedUris(response.data.preferences);
  }, ATProtoEndpointType.FEED);
}

/**
 * Reorder saved feeds
 */
export async function reorderSavedFeeds(feedUris: string[]): Promise<void> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    // Get current preferences
    const response = await agent.app.bsky.actor.getPreferences();
    const preferences = response.data.preferences;

    // Find saved feeds preference
    const savedFeedsIndex = preferences.findIndex(
      (pref) => pref.$type === "app.bsky.actor.defs#savedFeedsPref",
    );

    if (savedFeedsIndex >= 0) {
      const savedFeedsPref = preferences[savedFeedsIndex] as {
        saved?: string[];
        pinned?: string[];
      };
      const currentSaved = savedFeedsPref.saved || [];

      // Preserve any saved feeds that weren't in the reorder list
      const remainingSaved = currentSaved.filter((u) => !feedUris.includes(u));

      // Update preferences with new order for both saved and pinned
      const updatedPreferences = [...preferences];
      updatedPreferences[savedFeedsIndex] = {
        $type: "app.bsky.actor.defs#savedFeedsPref",
        saved: [...feedUris, ...remainingSaved],
        pinned: feedUris,
      };

      await agent.app.bsky.actor.putPreferences({
        preferences: updatedPreferences,
      });
    }
  }, ATProtoEndpointType.FEED);
}

export interface CreateFeedGeneratorParams {
  displayName: string;
  description?: string;
  serviceEndpoint: string;
  avatar?: string;
}

/**
 * Create a new feed generator record
 * Note: This only creates the record. You must have a feed generator service
 * running at the serviceEndpoint that implements the AT Protocol feed generator API.
 */
export async function createFeedGenerator(
  params: CreateFeedGeneratorParams,
): Promise<{ uri: string; cid: string }> {
  return rateLimited(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const session = client.getSession();

    if (!session?.did) {
      throw new Error("No active session");
    }

    const record = {
      $type: "app.bsky.feed.generator",
      did: session.did,
      displayName: params.displayName,
      description: params.description,
      avatar: params.avatar,
      createdAt: new Date().toISOString(),
    };

    const response = await agent.api.com.atproto.repo.createRecord({
      repo: session.did,
      collection: "app.bsky.feed.generator",
      record,
    });

    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  }, ATProtoEndpointType.RECORD);
}
