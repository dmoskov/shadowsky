/**
 * Postgate service — now sourced from the shared @bsky/core package.
 *
 * The canonical implementation lives in @bsky/core (consumed by web + mobile).
 * This web class is a thin wrapper that binds the agent and delegates.
 */

import type { BskyAgent } from "@atproto/api";
import { postgate } from "@bsky/core";

export class PostgateService {
  constructor(private agent: BskyAgent) {}

  /** Create a postgate record that disables embedding/quoting for a post. */
  createPostgate(postUri: string): Promise<{ uri: string; cid: string }> {
    return postgate.createPostgate(this.agent, postUri);
  }

  /** Delete a postgate record (re-enables embedding/quoting). */
  deletePostgate(postUri: string): Promise<boolean> {
    return postgate.deletePostgate(this.agent, postUri);
  }
}
