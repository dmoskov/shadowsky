import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {
  getStarterPack,
  getActorStarterPacks,
} from '../../services/atproto/starter-packs';
import {followUser} from '../../services/atproto/profiles';
import {mutationQueue} from '../../services/mutation-queue';


import { createLogger } from '../../utils/logger';

const logger = createLogger('Usestarterpacks');
/**
 * Hook to fetch a starter pack by URI
 */
export function useStarterPack(starterPackUri: string) {
  return useQuery({
    queryKey: ['starterPack', starterPackUri],
    queryFn: () => getStarterPack(starterPackUri),
    enabled: !!starterPackUri,
  });
}

/**
 * Hook to fetch starter packs created by an actor
 */
export function useActorStarterPacks(actor: string) {
  return useQuery({
    queryKey: ['actorStarterPacks', actor],
    queryFn: () => getActorStarterPacks(actor),
    enabled: !!actor,
  });
}

/**
 * Hook to follow all users in a starter pack
 */
export function useFollowAllFromStarterPack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dids: string[]) => {
      // Follow all users in parallel
      const results = await Promise.allSettled(
        dids.map(did => followUser(did))
      );

      // Return failed follows for potential retry
      const failed = results
        .map((result, index) => ({result, did: dids[index]}))
        .filter(({result}) => result.status === 'rejected')
        .map(({did}) => did);

      return {
        success: results.filter(r => r.status === 'fulfilled').length,
        failed: failed.length,
        failedDids: failed,
      };
    },
    onMutate: async (dids: string[]) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically mark all target profiles as followed
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || !dids.includes(old.did)) return old;
        return {
          ...old,
          viewer: {...old.viewer, following: 'pending'},
        };
      });

      return {previousProfiles};
    },
    onSuccess: (data) => {
      // Invalidate profile queries to refetch updated follow status
      queryClient.invalidateQueries({queryKey: ['profile']});

      // Queue failed follows for retry
      if (data.failedDids.length > 0) {
        logger.log(`${data.failedDids.length} follows failed, queueing for retry`);
        data.failedDids.forEach(async (did) => {
          await mutationQueue.enqueue({
            type: 'follow',
            targetUri: did,
            maxRetries: 3,
          });
        });
      }
    },
    onError: (_error, _dids, context) => {
      // Rollback optimistic updates
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
  });
}
