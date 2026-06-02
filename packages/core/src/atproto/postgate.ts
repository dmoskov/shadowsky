/**
 * Postgate operations against the AT Protocol (quote/embedding controls).
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that). Postgate records control
 * who can quote or embed a post; the record key (rkey) must match the post's.
 */

import type { BskyAgent } from "@atproto/api";

/**
 * Create a postgate record that disables embedding/quoting for a post.
 */
export async function createPostgate(
  agent: BskyAgent,
  postUri: string,
): Promise<{ uri: string; cid: string }> {
  const rkey = postUri.split("/").pop();
  if (!rkey) {
    throw new Error("Invalid post URI: cannot extract rkey");
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: "app.bsky.feed.postgate",
    rkey,
    record: {
      $type: "app.bsky.feed.postgate",
      post: postUri,
      createdAt: new Date().toISOString(),
      embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
    },
  });

  return response.data;
}

/**
 * Delete a postgate record (re-enables embedding/quoting). Returns false if the
 * URI is malformed or the delete fails.
 */
export async function deletePostgate(
  agent: BskyAgent,
  postUri: string,
): Promise<boolean> {
  const rkey = postUri.split("/").pop();
  if (!rkey) return false;

  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: agent.session!.did,
      collection: "app.bsky.feed.postgate",
      rkey,
    });
    return true;
  } catch {
    return false;
  }
}
