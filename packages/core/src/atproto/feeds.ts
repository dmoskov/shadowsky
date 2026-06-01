/**
 * Feed read operations against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains NO rate limiting (callers inject that — mobile wraps these in its
 * `rateLimited`, web calls them directly).
 */

import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";

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

/** Fetch the user's timeline feed. */
export async function getTimeline(
  agent: BskyAgent,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  const response = await agent.getTimeline({
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { feed: response.data.feed, cursor: response.data.cursor };
}

/** Fetch a custom feed by URI. */
export async function getFeed(
  agent: BskyAgent,
  feedUri: string,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  const response = await agent.app.bsky.feed.getFeed({
    feed: feedUri,
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { feed: response.data.feed, cursor: response.data.cursor };
}

/** Fetch an author feed (posts from a specific user). */
export async function getAuthorFeed(
  agent: BskyAgent,
  actor: string,
  options: AuthorFeedOptions = {},
): Promise<FeedResponse> {
  const response = await agent.getAuthorFeed({
    actor,
    limit: options.limit || 50,
    cursor: options.cursor,
    filter: options.filter,
  });
  return { feed: response.data.feed, cursor: response.data.cursor };
}

/** Fetch likes for a specific user. */
export async function getActorLikes(
  agent: BskyAgent,
  actor: string,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  const response = await agent.getActorLikes({
    actor,
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { feed: response.data.feed, cursor: response.data.cursor };
}

/** Get a single post thread with replies. Returns the thread view union. */
export async function getPostThread(
  agent: BskyAgent,
  uri: string,
  depth: number = 6,
  parentHeight: number = 80,
) {
  const response = await agent.getPostThread({ uri, depth, parentHeight });
  return response.data.thread;
}

/** Search posts with filters. */
export async function searchPosts(
  agent: BskyAgent,
  query: string,
  options: SearchPostsOptions = {},
): Promise<FeedResponse> {
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
}
