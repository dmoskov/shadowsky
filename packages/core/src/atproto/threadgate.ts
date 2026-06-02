/**
 * Threadgate operations against the AT Protocol (reply restrictions).
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that).
 */

import type { BskyAgent } from "@atproto/api";
import { logger } from "../logger";

export type ReplyPermission = "everyone" | "following" | "mentioned" | "none";

export interface ThreadgateSettings {
  permission: ReplyPermission;
  /** AT-URIs of lists for custom restrictions. */
  allowedLists?: string[];
}

interface ThreadgateFollowingRule {
  $type: "app.bsky.feed.threadgate#followingRule";
}

interface ThreadgateMentionRule {
  $type: "app.bsky.feed.threadgate#mentionRule";
}

interface ThreadgateListRule {
  $type: "app.bsky.feed.threadgate#listRule";
  list: string;
}

type ThreadgateAllowRule =
  | ThreadgateFollowingRule
  | ThreadgateMentionRule
  | ThreadgateListRule;

interface ThreadgateRecordValue {
  $type: "app.bsky.feed.threadgate";
  post: string;
  allow?: ThreadgateAllowRule[];
  createdAt: string;
}

interface ListRecordEntry {
  uri: string;
  cid: string;
  value: ThreadgateRecordValue;
}

/** Build allow rules based on permission settings. */
function buildAllowRules(settings: ThreadgateSettings): ThreadgateAllowRule[] {
  const allow: ThreadgateAllowRule[] = [];

  switch (settings.permission) {
    case "following":
      allow.push({ $type: "app.bsky.feed.threadgate#followingRule" });
      break;
    case "mentioned":
      allow.push({ $type: "app.bsky.feed.threadgate#mentionRule" });
      break;
    case "none":
      // Empty allow array means no one can reply
      break;
    default:
      // For custom lists or other future options
      if (settings.allowedLists) {
        settings.allowedLists.forEach((list) => {
          allow.push({
            $type: "app.bsky.feed.threadgate#listRule",
            list,
          });
        });
      }
  }

  return allow;
}

/** Parse a threadgate record into settings. */
function parseThreadgateRecord(
  record: ThreadgateRecordValue,
): ThreadgateSettings {
  if (!record.allow || record.allow.length === 0) {
    return { permission: "none" };
  }

  const firstRule = record.allow[0];

  switch (firstRule.$type) {
    case "app.bsky.feed.threadgate#followingRule":
      return { permission: "following" };
    case "app.bsky.feed.threadgate#mentionRule":
      return { permission: "mentioned" };
    case "app.bsky.feed.threadgate#listRule":
      return {
        permission: "everyone", // custom lists treated as a special case
        allowedLists: record.allow
          .filter(
            (rule): rule is ThreadgateListRule =>
              rule.$type === "app.bsky.feed.threadgate#listRule",
          )
          .map((rule) => rule.list),
      };
    default:
      return { permission: "everyone" };
  }
}

/** Create a threadgate record for a post with reply restrictions. */
export async function createThreadgate(
  agent: BskyAgent,
  postUri: string,
  settings: ThreadgateSettings,
) {
  if (settings.permission === "everyone") {
    // No threadgate needed for everyone
    return null;
  }

  const allow = buildAllowRules(settings);
  if (allow.length === 0 && settings.permission !== "none") {
    return null; // No restrictions needed
  }

  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session!.did,
      collection: "app.bsky.feed.threadgate",
      record: {
        $type: "app.bsky.feed.threadgate",
        post: postUri,
        allow: settings.permission === "none" ? [] : allow,
        createdAt: new Date().toISOString(),
      },
    });

    return response.data;
  } catch (error) {
    logger.error("Failed to create threadgate:", error);
    throw error;
  }
}

/** Update an existing threadgate record. */
export async function updateThreadgate(
  agent: BskyAgent,
  uri: string,
  rkey: string,
  settings: ThreadgateSettings,
) {
  if (settings.permission === "everyone") {
    // Delete the threadgate to allow everyone
    return deleteThreadgate(agent, rkey);
  }

  const allow = buildAllowRules(settings);

  try {
    const response = await agent.com.atproto.repo.putRecord({
      repo: agent.session!.did,
      collection: "app.bsky.feed.threadgate",
      rkey,
      record: {
        $type: "app.bsky.feed.threadgate",
        post: uri,
        allow: settings.permission === "none" ? [] : allow,
        createdAt: new Date().toISOString(),
      },
    });

    return response.data;
  } catch (error) {
    logger.error("Failed to update threadgate:", error);
    throw error;
  }
}

/** Delete a threadgate record (opens replies to everyone). */
export async function deleteThreadgate(agent: BskyAgent, rkey: string) {
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: agent.session!.did,
      collection: "app.bsky.feed.threadgate",
      rkey,
    });
    return true;
  } catch (error) {
    logger.error("Failed to delete threadgate:", error);
    return false;
  }
}

/** Get threadgate settings for a post. */
export async function getThreadgate(
  agent: BskyAgent,
  postUri: string,
): Promise<ThreadgateSettings | null> {
  try {
    // Extract DID from the post URI (at://did/collection/rkey)
    const did = postUri.split("/")[2];

    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: "app.bsky.feed.threadgate",
      limit: 100,
    });

    // Find the threadgate for this specific post
    const threadgate = (
      response.data.records as unknown as ListRecordEntry[]
    ).find((record) => record.value.post === postUri);

    if (!threadgate) {
      return null;
    }

    return parseThreadgateRecord(threadgate.value);
  } catch (error) {
    logger.error("Failed to fetch threadgate:", error);
    return null;
  }
}

/**
 * Check if a user can reply to a post based on threadgate settings.
 *
 * Note: only "everyone"/"none" are resolved locally; following/mentioned/list
 * rules require relationship lookups and are deferred to server validation.
 */
export async function canUserReply(
  agent: BskyAgent,
  postUri: string,
  _userDid: string,
  _postAuthorDid: string,
): Promise<boolean> {
  const settings = await getThreadgate(agent, postUri);

  if (!settings || settings.permission === "everyone") {
    return true;
  }

  if (settings.permission === "none") {
    return false;
  }

  // following / mentioned / custom-list rules would require extra relationship
  // lookups; defer to server-side validation for now.
  return true;
}
