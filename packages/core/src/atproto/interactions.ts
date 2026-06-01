/**
 * Post interaction operations against the AT Protocol (like/repost/delete and
 * engagement listings).
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that). Post *creation* and media
 * upload are intentionally NOT here — they involve platform-specific file/blob
 * handling and live in each app.
 */

import type { BskyAgent } from "@atproto/api";

export async function likePost(agent: BskyAgent, uri: string, cid: string) {
  return agent.like(uri, cid);
}

export async function unlikePost(agent: BskyAgent, likeUri: string) {
  await agent.deleteLike(likeUri);
}

export async function repost(agent: BskyAgent, uri: string, cid: string) {
  return agent.repost(uri, cid);
}

export async function deleteRepost(agent: BskyAgent, repostUri: string) {
  await agent.deleteRepost(repostUri);
}

export async function deletePost(agent: BskyAgent, uri: string) {
  await agent.deletePost(uri);
}

export async function getLikes(agent: BskyAgent, uri: string, cursor?: string) {
  const response = await agent.getLikes({ uri, limit: 50, cursor });
  return { likes: response.data.likes, cursor: response.data.cursor };
}

export async function getRepostedBy(
  agent: BskyAgent,
  uri: string,
  cursor?: string,
) {
  const response = await agent.getRepostedBy({ uri, limit: 50, cursor });
  return { repostedBy: response.data.repostedBy, cursor: response.data.cursor };
}

export async function getQuotes(
  agent: BskyAgent,
  uri: string,
  cursor?: string,
) {
  const response = await agent.app.bsky.feed.getQuotes({
    uri,
    limit: 50,
    cursor,
  });
  return { posts: response.data.posts, cursor: response.data.cursor };
}
