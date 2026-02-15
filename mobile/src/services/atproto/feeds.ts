import {getAtProtoClient} from './client';
import { AppBskyFeedDefs, AppBskyFeedDefs as FeedDefs } from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

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
export async function getTimeline(options: FeedOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch a custom feed by URI
 */
export async function getFeed(feedUri: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch author feed (posts from a specific user)
 */
export async function getAuthorFeed(actor: string, options: AuthorFeedOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch likes for a specific user
 */
export async function getActorLikes(actor: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get a single post thread with replies
 */
export async function getPostThread(uri: string, depth: number = 6) {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getPostThread({
          uri,
          depth,
        });

        return response.data.thread;
      }),
    ATProtoEndpointType.FEED
  );
}

export interface SearchPostsOptions extends FeedOptions {
  sort?: 'top' | 'latest';
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
export async function searchPosts(query: string, options: SearchPostsOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

export interface FeedGeneratorResponse {
  feeds: FeedDefs.GeneratorView[];
  cursor?: string;
}

/**
 * Get popular feed generators
 */
export async function getPopularFeedGenerators(options: FeedOptions = {}): Promise<FeedGeneratorResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get suggested feed generators for the current user
 */
export async function getSuggestedFeeds(options: FeedOptions = {}): Promise<FeedGeneratorResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Search for feed generators by query (client-side filtering of popular feeds)
 * Note: AT Protocol doesn't have a native search endpoint for feed generators yet,
 * so we fetch popular feeds and filter them client-side
 */
export async function searchFeedGenerators(query: string, options: FeedOptions = {}): Promise<FeedGeneratorResponse> {
  if (!query || query.trim() === '') {
    return {feeds: [], cursor: undefined};
  }

  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Fetch popular feeds and filter client-side
        const response = await agent.app.bsky.unspecced.getPopularFeedGenerators({
          limit: 100, // Fetch more to have better search results
          cursor: options.cursor,
        });

        const searchLower = query.toLowerCase().trim();
        const filteredFeeds = response.data.feeds.filter((feed) => {
          const displayName = feed.displayName?.toLowerCase() || '';
          const description = feed.description?.toLowerCase() || '';
          const creatorHandle = feed.creator.handle?.toLowerCase() || '';

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
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get the current user's saved feeds (feed preferences)
 */
export async function getSavedFeeds(): Promise<FeedDefs.GeneratorView[]> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.actor.getPreferences();
        const savedFeedsPreference = response.data.preferences.find(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        ) as {saved?: string[]; pinned?: string[]} | undefined;

        if (!savedFeedsPreference || !savedFeedsPreference.saved || savedFeedsPreference.saved.length === 0) {
          return [];
        }

        // Get feed generator info for all saved feeds
        const feedsResponse = await agent.app.bsky.feed.getFeedGenerators({
          feeds: savedFeedsPreference.saved,
        });

        return feedsResponse.data.feeds;
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Save a feed to the user's preferences
 */
export async function saveFeed(feedUri: string): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Get current preferences
        const response = await agent.app.bsky.actor.getPreferences();
        const preferences = response.data.preferences;

        // Find saved feeds preference
        const savedFeedsIndex = preferences.findIndex(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        );

        let savedFeeds: string[] = [];
        let pinnedFeeds: string[] = [];

        if (savedFeedsIndex >= 0) {
          const savedFeedsPref = preferences[savedFeedsIndex] as {saved?: string[]; pinned?: string[]};
          savedFeeds = savedFeedsPref.saved || [];
          pinnedFeeds = savedFeedsPref.pinned || [];
        }

        // Add feed if not already saved
        if (!savedFeeds.includes(feedUri)) {
          savedFeeds.push(feedUri);

          // Update preferences
          const updatedPreferences = [...preferences];
          if (savedFeedsIndex >= 0) {
            updatedPreferences[savedFeedsIndex] = {
              $type: 'app.bsky.actor.defs#savedFeedsPref',
              saved: savedFeeds,
              pinned: pinnedFeeds,
            };
          } else {
            updatedPreferences.push({
              $type: 'app.bsky.actor.defs#savedFeedsPref',
              saved: savedFeeds,
              pinned: pinnedFeeds,
            });
          }

          await agent.app.bsky.actor.putPreferences({preferences: updatedPreferences});
        }
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Remove a feed from the user's preferences
 */
export async function unsaveFeed(feedUri: string): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Get current preferences
        const response = await agent.app.bsky.actor.getPreferences();
        const preferences = response.data.preferences;

        // Find saved feeds preference
        const savedFeedsIndex = preferences.findIndex(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        );

        if (savedFeedsIndex >= 0) {
          const savedFeedsPref = preferences[savedFeedsIndex] as {saved?: string[]; pinned?: string[]};
          const savedFeeds = savedFeedsPref.saved || [];
          const pinnedFeeds = savedFeedsPref.pinned || [];

          // Remove feed from saved and pinned
          const updatedSavedFeeds = savedFeeds.filter((uri) => uri !== feedUri);
          const updatedPinnedFeeds = pinnedFeeds.filter((uri) => uri !== feedUri);

          // Update preferences
          const updatedPreferences = [...preferences];
          updatedPreferences[savedFeedsIndex] = {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            saved: updatedSavedFeeds,
            pinned: updatedPinnedFeeds,
          };

          await agent.app.bsky.actor.putPreferences({preferences: updatedPreferences});
        }
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Pin a feed to the home screen
 */
export async function pinFeed(feedUri: string): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Get current preferences
        const response = await agent.app.bsky.actor.getPreferences();
        const preferences = response.data.preferences;

        // Find saved feeds preference
        const savedFeedsIndex = preferences.findIndex(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        );

        let savedFeeds: string[] = [];
        let pinnedFeeds: string[] = [];

        if (savedFeedsIndex >= 0) {
          const savedFeedsPref = preferences[savedFeedsIndex] as {saved?: string[]; pinned?: string[]};
          savedFeeds = savedFeedsPref.saved || [];
          pinnedFeeds = savedFeedsPref.pinned || [];
        }

        // Add feed to pinned if not already pinned
        if (!pinnedFeeds.includes(feedUri)) {
          pinnedFeeds.push(feedUri);

          // Also ensure it's saved
          if (!savedFeeds.includes(feedUri)) {
            savedFeeds.push(feedUri);
          }

          // Update preferences
          const updatedPreferences = [...preferences];
          if (savedFeedsIndex >= 0) {
            updatedPreferences[savedFeedsIndex] = {
              $type: 'app.bsky.actor.defs#savedFeedsPref',
              saved: savedFeeds,
              pinned: pinnedFeeds,
            };
          } else {
            updatedPreferences.push({
              $type: 'app.bsky.actor.defs#savedFeedsPref',
              saved: savedFeeds,
              pinned: pinnedFeeds,
            });
          }

          await agent.app.bsky.actor.putPreferences({preferences: updatedPreferences});
        }
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Unpin a feed from the home screen
 */
export async function unpinFeed(feedUri: string): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Get current preferences
        const response = await agent.app.bsky.actor.getPreferences();
        const preferences = response.data.preferences;

        // Find saved feeds preference
        const savedFeedsIndex = preferences.findIndex(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        );

        if (savedFeedsIndex >= 0) {
          const savedFeedsPref = preferences[savedFeedsIndex] as {saved?: string[]; pinned?: string[]};
          const savedFeeds = savedFeedsPref.saved || [];
          const pinnedFeeds = savedFeedsPref.pinned || [];

          // Remove feed from pinned
          const updatedPinnedFeeds = pinnedFeeds.filter((uri) => uri !== feedUri);

          // Update preferences
          const updatedPreferences = [...preferences];
          updatedPreferences[savedFeedsIndex] = {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            saved: savedFeeds,
            pinned: updatedPinnedFeeds,
          };

          await agent.app.bsky.actor.putPreferences({preferences: updatedPreferences});
        }
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get the pinned feeds for the current user
 */
export async function getPinnedFeeds(): Promise<string[]> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.actor.getPreferences();
        const savedFeedsPreference = response.data.preferences.find(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        ) as {saved?: string[]; pinned?: string[]} | undefined;

        return savedFeedsPreference?.pinned || [];
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Reorder saved feeds
 */
export async function reorderSavedFeeds(feedUris: string[]): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        // Get current preferences
        const response = await agent.app.bsky.actor.getPreferences();
        const preferences = response.data.preferences;

        // Find saved feeds preference
        const savedFeedsIndex = preferences.findIndex(
          (pref) => pref.$type === 'app.bsky.actor.defs#savedFeedsPref'
        );

        if (savedFeedsIndex >= 0) {
          const savedFeedsPref = preferences[savedFeedsIndex] as {saved?: string[]; pinned?: string[]};
          const pinnedFeeds = savedFeedsPref.pinned || [];

          // Update preferences with new order
          const updatedPreferences = [...preferences];
          updatedPreferences[savedFeedsIndex] = {
            $type: 'app.bsky.actor.defs#savedFeedsPref',
            saved: feedUris,
            pinned: pinnedFeeds,
          };

          await agent.app.bsky.actor.putPreferences({preferences: updatedPreferences});
        }
      }),
    ATProtoEndpointType.FEED
  );
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
export async function createFeedGenerator(params: CreateFeedGeneratorParams): Promise<{uri: string; cid: string}> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();
        const session = client.getSession();

        if (!session?.did) {
          throw new Error('No active session');
        }

        const record = {
          $type: 'app.bsky.feed.generator',
          did: session.did,
          displayName: params.displayName,
          description: params.description,
          avatar: params.avatar,
          createdAt: new Date().toISOString(),
        };

        const response = await agent.api.com.atproto.repo.createRecord({
          repo: session.did,
          collection: 'app.bsky.feed.generator',
          record,
        });

        return {
          uri: response.data.uri,
          cid: response.data.cid,
        };
      }),
    ATProtoEndpointType.RECORD
  );
}
