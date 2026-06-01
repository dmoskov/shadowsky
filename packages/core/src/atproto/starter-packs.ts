/**
 * Starter pack operations against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that).
 */

import type { AppBskyGraphDefs, BskyAgent } from "@atproto/api";

/** Get a starter pack by AT-URI. */
export async function getStarterPack(
  agent: BskyAgent,
  starterPackUri: string,
): Promise<AppBskyGraphDefs.StarterPackView> {
  const response = await agent.app.bsky.graph.getStarterPack({
    starterPack: starterPackUri,
  });
  return response.data.starterPack;
}

/** Get starter packs created by an actor. */
export async function getActorStarterPacks(
  agent: BskyAgent,
  actor: string,
  cursor?: string,
): Promise<{
  starterPacks: AppBskyGraphDefs.StarterPackViewBasic[];
  cursor?: string;
}> {
  const response = await agent.app.bsky.graph.getActorStarterPacks({
    actor,
    limit: 50,
    cursor,
  });
  return {
    starterPacks: response.data.starterPacks,
    cursor: response.data.cursor,
  };
}
