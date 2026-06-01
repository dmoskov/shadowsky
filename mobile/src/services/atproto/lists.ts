import {lists as coreLists} from '@bsky/core';
import {AppBskyGraphDefs} from '@atproto/api';
import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export type ListsResponse = coreLists.ListsResponse;
export type ListFeedOptions = coreLists.ListFeedOptions;
export type ListFeedResponse = coreLists.ListFeedResponse;

const agent = () => getAtProtoClient().getAgent();

/**
 * The AT Protocol calls live in @bsky/core; these thin wrappers add mobile's
 * singleton agent + per-endpoint rateLimited throttling. Signatures/return
 * shapes are unchanged from the previous local implementation.
 */

export async function getUserLists(
  options: {limit?: number; cursor?: string} = {},
): Promise<ListsResponse> {
  return rateLimited(
    () => coreLists.getUserLists(agent(), options),
    ATProtoEndpointType.FEED,
  );
}

export async function getList(
  listUri: string,
): Promise<AppBskyGraphDefs.ListView | null> {
  return rateLimited(
    () => coreLists.getList(agent(), listUri),
    ATProtoEndpointType.FEED,
  );
}

export async function getListFeed(
  listUri: string,
  options: ListFeedOptions = {},
): Promise<ListFeedResponse> {
  return rateLimited(
    () => coreLists.getListFeed(agent(), listUri, options),
    ATProtoEndpointType.FEED,
  );
}

export async function createList(
  name: string,
  description?: string,
  purpose: string = 'app.bsky.graph.defs#curatelist',
): Promise<{uri: string; cid: string}> {
  return rateLimited(
    () => coreLists.createList(agent(), name, description, purpose),
    ATProtoEndpointType.RECORD,
  );
}

export async function deleteList(listUri: string): Promise<void> {
  return rateLimited(
    () => coreLists.deleteList(agent(), listUri),
    ATProtoEndpointType.RECORD,
  );
}

export async function getListMembers(
  listUri: string,
  options: {limit?: number; cursor?: string} = {},
): Promise<{items: AppBskyGraphDefs.ListItemView[]; cursor?: string}> {
  return rateLimited(
    () => coreLists.getListMembers(agent(), listUri, options),
    ATProtoEndpointType.FEED,
  );
}

export async function addUserToList(
  listUri: string,
  did: string,
): Promise<{uri: string; cid: string}> {
  return rateLimited(
    () => coreLists.addUserToList(agent(), listUri, did),
    ATProtoEndpointType.RECORD,
  );
}

export async function removeUserFromList(listItemUri: string): Promise<void> {
  return rateLimited(
    () => coreLists.removeUserFromList(agent(), listItemUri),
    ATProtoEndpointType.RECORD,
  );
}

export async function updateList(
  listUri: string,
  updates: {name?: string; description?: string; purpose?: string},
): Promise<{uri: string; cid: string}> {
  return rateLimited(
    () => coreLists.updateList(agent(), listUri, updates),
    ATProtoEndpointType.RECORD,
  );
}
