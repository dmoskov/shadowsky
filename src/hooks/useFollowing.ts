import { useMemo } from "react";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

export function useFollowing() {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["following", session?.did],
    queryFn: async () => {
      if (!session?.did) throw new Error("No user DID");

      const { atProtoClient } = await import("../services/atproto");
      const agent = atProtoClient.agent;
      if (!agent) throw new Error("Not authenticated");

      // Fetch all follows (paginated)
      const follows = new Set<string>();
      let cursor: string | undefined;

      try {
        do {
          const response = await agent.app.bsky.graph.getFollows({
            actor: session.did,
            limit: 100,
            cursor,
          });

          response.data.follows.forEach((follow) => {
            follows.add(follow.did);
          });

          cursor = response.data.cursor;
        } while (cursor);

        debug.log(`Loaded ${follows.size} following accounts`);
        return follows;
      } catch (error) {
        debug.error("Failed to fetch following list:", error);
        throw error;
      }
    },
    enabled: !!session?.did,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Create a stable reference for the Set to prevent unnecessary re-renders
  const stableFollowingSet = useMemo(() => {
    if (!query.data) return undefined;
    
    // Convert Set to array, sort it for consistent ordering, then back to Set
    // This ensures the same content always produces the same reference
    const sortedDids = Array.from(query.data).sort();
    return new Set(sortedDids);
  }, [query.data]);

  return {
    ...query,
    data: stableFollowingSet,
  };
}
