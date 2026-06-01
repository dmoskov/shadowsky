/**
 * List (curate/mod list) operations against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * (the acting DID is read from `agent.session`) and contains no rate limiting.
 */

import type { AppBskyGraphDefs, BskyAgent } from "@atproto/api";
import { logger } from "../logger";

export interface ListsResponse {
  lists: AppBskyGraphDefs.ListView[];
  cursor?: string;
}

export interface ListFeedOptions {
  limit?: number;
  cursor?: string;
}

export interface ListFeedResponse {
  feed: any[];
  cursor?: string;
}

function requireDid(agent: BskyAgent): string {
  const did = agent.session?.did;
  if (!did) throw new Error("No active session");
  return did;
}

/** Fetch the current user's lists. */
export async function getUserLists(
  agent: BskyAgent,
  options: { limit?: number; cursor?: string } = {},
): Promise<ListsResponse> {
  const response = await agent.app.bsky.graph.getLists({
    actor: requireDid(agent),
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { lists: response.data.lists, cursor: response.data.cursor };
}

/** Fetch a specific list by URI. Returns null on error. */
export async function getList(
  agent: BskyAgent,
  listUri: string,
): Promise<AppBskyGraphDefs.ListView | null> {
  try {
    const response = await agent.app.bsky.graph.getList({
      list: listUri,
      limit: 1,
    });
    return response.data.list;
  } catch (error) {
    logger.error(`Failed to fetch list ${listUri}:`, error);
    return null;
  }
}

/** Fetch the feed for a specific list. */
export async function getListFeed(
  agent: BskyAgent,
  listUri: string,
  options: ListFeedOptions = {},
): Promise<ListFeedResponse> {
  const response = await agent.app.bsky.feed.getListFeed({
    list: listUri,
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { feed: response.data.feed, cursor: response.data.cursor };
}

/** Create a new list. */
export async function createList(
  agent: BskyAgent,
  name: string,
  description?: string,
  purpose: string = "app.bsky.graph.defs#curatelist",
): Promise<{ uri: string; cid: string }> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: requireDid(agent),
    collection: "app.bsky.graph.list",
    record: {
      $type: "app.bsky.graph.list",
      purpose,
      name,
      description,
      createdAt: new Date().toISOString(),
    },
  });
  return { uri: response.data.uri, cid: response.data.cid };
}

/** Delete a list. */
export async function deleteList(
  agent: BskyAgent,
  listUri: string,
): Promise<void> {
  const rkey = listUri.split("/").pop();
  if (!rkey) throw new Error("Invalid list URI");
  await agent.com.atproto.repo.deleteRecord({
    repo: requireDid(agent),
    collection: "app.bsky.graph.list",
    rkey,
  });
}

/** Get members of a list. */
export async function getListMembers(
  agent: BskyAgent,
  listUri: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<{ items: AppBskyGraphDefs.ListItemView[]; cursor?: string }> {
  const response = await agent.app.bsky.graph.getList({
    list: listUri,
    limit: options.limit || 50,
    cursor: options.cursor,
  });
  return { items: response.data.items, cursor: response.data.cursor };
}

/** Add a user to a list. */
export async function addUserToList(
  agent: BskyAgent,
  listUri: string,
  did: string,
): Promise<{ uri: string; cid: string }> {
  const response = await agent.com.atproto.repo.createRecord({
    repo: requireDid(agent),
    collection: "app.bsky.graph.listitem",
    record: {
      $type: "app.bsky.graph.listitem",
      subject: did,
      list: listUri,
      createdAt: new Date().toISOString(),
    },
  });
  return { uri: response.data.uri, cid: response.data.cid };
}

/** Remove a user from a list (by list-item URI). */
export async function removeUserFromList(
  agent: BskyAgent,
  listItemUri: string,
): Promise<void> {
  const rkey = listItemUri.split("/").pop();
  if (!rkey) throw new Error("Invalid list item URI");
  await agent.com.atproto.repo.deleteRecord({
    repo: requireDid(agent),
    collection: "app.bsky.graph.listitem",
    rkey,
  });
}

/** Update a list's metadata (name, description, purpose). */
export async function updateList(
  agent: BskyAgent,
  listUri: string,
  updates: { name?: string; description?: string; purpose?: string },
): Promise<{ uri: string; cid: string }> {
  const rkey = listUri.split("/").pop();
  if (!rkey) throw new Error("Invalid list URI");

  const currentList = await getList(agent, listUri);
  if (!currentList) throw new Error("List not found");

  const response = await agent.com.atproto.repo.putRecord({
    repo: requireDid(agent),
    collection: "app.bsky.graph.list",
    rkey,
    record: {
      $type: "app.bsky.graph.list",
      purpose: updates.purpose || currentList.purpose,
      name: updates.name || currentList.name,
      description:
        updates.description !== undefined
          ? updates.description
          : currentList.description,
      createdAt: currentList.indexedAt || new Date().toISOString(),
    },
  });
  return { uri: response.data.uri, cid: response.data.cid };
}
