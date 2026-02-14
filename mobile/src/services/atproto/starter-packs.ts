import {getAtProtoClient} from './client';
import {AppBskyGraphDefs} from '@atproto/api';
import {withRetry} from '../../utils/with-retry';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

/**
 * Get a starter pack by AT-URI
 */
export async function getStarterPack(
  starterPackUri: string
): Promise<AppBskyGraphDefs.StarterPackView> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.graph.getStarterPack({
          starterPack: starterPackUri,
        });
        return response.data.starterPack;
      }),
    ATProtoEndpointType.FEED
  );
}

/**
 * Get starter packs created by an actor
 */
export async function getActorStarterPacks(
  actor: string,
  cursor?: string
): Promise<{
  starterPacks: AppBskyGraphDefs.StarterPackViewBasic[];
  cursor?: string;
}> {
  return rateLimited(
    async () =>
      withRetry(async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.graph.getActorStarterPacks({
          actor,
          limit: 50,
          cursor,
        });

        return {
          starterPacks: response.data.starterPacks,
          cursor: response.data.cursor,
        };
      }),
    ATProtoEndpointType.FEED
  );
}
