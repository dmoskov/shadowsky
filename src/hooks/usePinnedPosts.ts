import type { AppBskyFeedDefs } from "@atproto/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { pinService, type PinnedPost } from "../services/pin-service";

export interface UsePinnedPostsOptions {
  did: string;
  enabled?: boolean;
}

export interface PinnedPostWithDetails extends PinnedPost {
  post: AppBskyFeedDefs.PostView;
}

export function usePinnedPosts({ did, enabled = true }: UsePinnedPostsOptions) {
  const { agent, session } = useAuth();
  const queryClient = useQueryClient();

  // Set agent on service when available
  useEffect(() => {
    pinService.setAgent(agent || null);
  }, [agent]);

  const isOwnProfile = session?.did === did;

  const query = useQuery({
    queryKey: ["pinned-posts", did],
    queryFn: async () => {
      if (!did) throw new Error("No DID provided");
      return pinService.getPinnedPostsWithDetails(did);
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    enabled: !!agent && !!did && enabled,
  });

  const pinMutation = useMutation({
    mutationFn: async ({
      postUri,
      postCid,
    }: {
      postUri: string;
      postCid: string;
    }) => {
      const result = await pinService.pinPost(postUri, postCid);
      if (!result) {
        throw new Error("Failed to pin post");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-posts", did] });
    },
  });

  const unpinMutation = useMutation({
    mutationFn: async (postUri: string) => {
      const result = await pinService.unpinPost(postUri);
      if (!result) {
        throw new Error("Failed to unpin post");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-posts", did] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (pinUris: string[]) => {
      const result = await pinService.reorderPins(pinUris);
      if (!result) {
        throw new Error("Failed to reorder pins");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-posts", did] });
    },
  });

  const isPinned = (postUri: string): boolean => {
    if (!query.data) return false;
    return query.data.some((pin) => pin.record.postUri === postUri);
  };

  const canPin = (): boolean => {
    if (!isOwnProfile) return false;
    if (!query.data) return true;
    return query.data.length < pinService.getMaxPins();
  };

  const togglePin = async (
    postUri: string,
    postCid: string,
  ): Promise<boolean> => {
    if (isPinned(postUri)) {
      await unpinMutation.mutateAsync(postUri);
      return false;
    } else {
      await pinMutation.mutateAsync({ postUri, postCid });
      return true;
    }
  };

  return {
    pinnedPosts: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isPinned,
    canPin,
    pinPost: pinMutation.mutateAsync,
    unpinPost: unpinMutation.mutateAsync,
    reorderPins: reorderMutation.mutateAsync,
    togglePin,
    isOwnProfile,
    maxPins: pinService.getMaxPins(),
    isPinning: pinMutation.isPending,
    isUnpinning: unpinMutation.isPending,
    refetch: query.refetch,
  };
}
