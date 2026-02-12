import {getAtProtoClient} from './client';
import {AppBskyFeedDefs, AppBskyFeedGetTimeline} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export interface FeedOptions {
  limit?: number;
  cursor?: string;
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
export async function getAuthorFeed(actor: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.getAuthorFeed({
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
