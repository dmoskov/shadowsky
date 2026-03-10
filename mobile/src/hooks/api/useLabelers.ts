import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {
  getSubscribedLabelers,
  getDirectoryLabelers,
  searchLabelers,
  subscribeToLabeler,
  unsubscribeFromLabeler,
  type LabelerCategory,
  type LabelerInfo,
} from '../../services/atproto/labelers';

/**
 * Hook to fetch user's subscribed labelers
 */
export function useSubscribedLabelers() {
  const {session} = useAuth();
  return useQuery({
    queryKey: ['subscribedLabelers'],
    queryFn: () => getSubscribedLabelers(),
    enabled: !!session,
  });
}

/**
 * Hook to fetch curated directory labelers by category
 */
export function useDirectoryLabelers(category?: LabelerCategory) {
  const {session} = useAuth();
  return useQuery({
    queryKey: ['directoryLabelers', category],
    queryFn: () => getDirectoryLabelers(category),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to search for labelers
 */
export function useSearchLabelers(query: string) {
  const {session} = useAuth();
  return useQuery({
    queryKey: ['searchLabelers', query],
    queryFn: () => searchLabelers(query),
    enabled: !!session && !!query.trim(),
  });
}

/**
 * Hook to subscribe to a labeler
 */
export function useSubscribeToLabeler() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (labelerDid: string) => subscribeToLabeler(labelerDid),
    onMutate: async (labelerDid) => {
      await queryClient.cancelQueries({queryKey: ['subscribedLabelers']});

      const previous = queryClient.getQueryData<{did: string}[]>(['subscribedLabelers']);

      if (previous) {
        queryClient.setQueryData(
          ['subscribedLabelers'],
          [...previous, {did: labelerDid}],
        );
      }

      return {previous};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['subscribedLabelers']});
    },
    onError: (_error, _labelerDid, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['subscribedLabelers'], context.previous);
      }
      showToast('Failed to subscribe to labeler', {type: 'error'});
    },
  });
}

/**
 * Hook to unsubscribe from a labeler
 */
export function useUnsubscribeFromLabeler() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (labelerDid: string) => unsubscribeFromLabeler(labelerDid),
    onMutate: async (labelerDid) => {
      await queryClient.cancelQueries({queryKey: ['subscribedLabelers']});

      const previous = queryClient.getQueryData<{did: string}[]>(['subscribedLabelers']);

      if (previous) {
        queryClient.setQueryData(
          ['subscribedLabelers'],
          previous.filter(l => l.did !== labelerDid),
        );
      }

      return {previous};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['subscribedLabelers']});
    },
    onError: (_error, _labelerDid, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['subscribedLabelers'], context.previous);
      }
      showToast('Failed to unsubscribe from labeler', {type: 'error'});
    },
  });
}
