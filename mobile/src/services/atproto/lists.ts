import {getAtProtoClient} from './client';
import {AppBskyGraphDefs} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export interface ListsResponse {
  lists: AppBskyGraphDefs.ListView[];
  cursor?: string;
}

export interface ListFeedOptions {
  limit?: number;
  cursor?: string;
}

export interface ListFeedResponse {
  feed: any[]; // AT Protocol list feed posts
  cursor?: string;
}

/**
 * Fetch the user's lists
 */
export async function getUserLists(): Promise<ListsResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();
        const session = client.getSession();

        if (!session?.did) {
          throw new Error('No active session');
        }

        const response = await agent.app.bsky.graph.getLists({
          actor: session.did,
          limit: 100,
        });

        return {
          lists: response.data.lists,
          cursor: response.data.cursor,
        };
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Fetch a specific list by URI
 */
export async function getList(listUri: string): Promise<AppBskyGraphDefs.ListView | null> {
  try {
    return await rateLimited(
      async () =>
        withRetry(async () => {
          const client = getAtProtoClient();
          const agent = client.getAgent();

          const response = await agent.app.bsky.graph.getList({
            list: listUri,
            limit: 1,
          });

          return response.data.list;
        }),
      ATProtoEndpointType.FEED
    );
  } catch (error) {
    console.error(`Failed to fetch list ${listUri}:`, error);
    return null;
  }
}

/**
 * Fetch the feed for a specific list
 */
export async function getListFeed(
  listUri: string,
  options: ListFeedOptions = {}
): Promise<ListFeedResponse> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.feed.getListFeed({
          list: listUri,
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
 * Create a new list
 */
export async function createList(
  name: string,
  description?: string,
  purpose: string = 'app.bsky.graph.defs#curatelist'
): Promise<{uri: string; cid: string}> {
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
          $type: 'app.bsky.graph.list',
          purpose,
          name,
          description,
          createdAt: new Date().toISOString(),
        };

        const response = await agent.api.com.atproto.repo.createRecord({
          repo: session.did,
          collection: 'app.bsky.graph.list',
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

/**
 * Delete a list
 */
export async function deleteList(listUri: string): Promise<void> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();
        const session = client.getSession();

        if (!session?.did) {
          throw new Error('No active session');
        }

        const rkey = listUri.split('/').pop();
        if (!rkey) {
          throw new Error('Invalid list URI');
        }

        await agent.api.com.atproto.repo.deleteRecord({
          repo: session.did,
          collection: 'app.bsky.graph.list',
          rkey,
        });
      }),
    ATProtoEndpointType.RECORD
  );
}
