/**
 * Threadgate service — now sourced from the shared @bsky/core package.
 *
 * The canonical implementation lives in @bsky/core (consumed by web + mobile).
 * This web class is a thin wrapper that binds the agent and delegates.
 */

import type { BskyAgent } from "@atproto/api";
import { threadgate } from "@bsky/core";

export type ReplyPermission = threadgate.ReplyPermission;
export type ThreadgateSettings = threadgate.ThreadgateSettings;

export class ThreadgateService {
  constructor(private agent: BskyAgent) {}

  /** Create a threadgate record for a post with reply restrictions. */
  createThreadgate(postUri: string, settings: ThreadgateSettings) {
    return threadgate.createThreadgate(this.agent, postUri, settings);
  }

  /** Update an existing threadgate record. */
  updateThreadgate(uri: string, rkey: string, settings: ThreadgateSettings) {
    return threadgate.updateThreadgate(this.agent, uri, rkey, settings);
  }

  /** Delete a threadgate record (opens replies to everyone). */
  deleteThreadgate(_uri: string, rkey: string) {
    return threadgate.deleteThreadgate(this.agent, rkey);
  }

  /** Get threadgate settings for a post. */
  getThreadgate(postUri: string): Promise<ThreadgateSettings | null> {
    return threadgate.getThreadgate(this.agent, postUri);
  }

  /** Check if a user can reply to a post based on threadgate settings. */
  canUserReply(
    postUri: string,
    userDid: string,
    postAuthorDid: string,
  ): Promise<boolean> {
    return threadgate.canUserReply(this.agent, postUri, userDid, postAuthorDid);
  }
}
