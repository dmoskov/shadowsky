import {getAtProtoClient} from './client';
import {AppBskyFeedDefs, AppBskyFeedGetTimeline} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';

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
  return withRetry(async () => {
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
  });
}

/**
 * Fetch a custom feed by URI
 */
export async function getFeed(feedUri: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return withRetry(async () => {
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
  });
}

/**
 * Fetch author feed (posts from a specific user)
 */
export async function getAuthorFeed(actor: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return withRetry(async () => {
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
  });
}

/**
 * Fetch likes for a specific user
 */
export async function getActorLikes(actor: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return withRetry(async () => {
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
  });
}

/**
 * Get a single post thread with replies
 */
export async function getPostThread(uri: string, depth: number = 6) {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.getPostThread({
      uri,
      depth,
    });

    return response.data.thread;
  });
}

/**
 * Search posts
 */
export async function searchPosts(query: string, options: FeedOptions = {}): Promise<FeedResponse> {
  return withRetry(async () => {
    const client = getAtProtoClient();
    const agent = client.getAgent();

    const response = await agent.app.bsky.feed.searchPosts({
      q: query,
      limit: options.limit || 50,
      cursor: options.cursor,
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
  });
}
