import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  ComposerState,
  EnrichedDraft,
} from '../../services/drafts';

/**
 * Hook for fetching drafts with infinite query support
 */
export function useDrafts() {
  return useInfiniteQuery({
    queryKey: ['drafts'],
    queryFn: async ({ pageParam }) => {
      return await getDrafts(pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for saving a draft (create or update)
 */
export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draftId,
      state,
      originalLocalRefs,
    }: {
      draftId?: string;
      state: ComposerState;
      originalLocalRefs?: string[];
    }) => {
      if (draftId) {
        // Update existing draft
        await updateDraft(draftId, state, originalLocalRefs);
        return draftId;
      } else {
        // Create new draft
        const id = await createDraft(state);
        return id;
      }
    },
    onSuccess: () => {
      // Invalidate drafts query to refetch
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
    onError: (error) => {
      console.error('Failed to save draft:', error);
    },
  });
}

/**
 * Hook for deleting a draft
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraft(draftId);
    },
    onMutate: async (draftId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['drafts'] });

      // Snapshot the previous value
      const previousDrafts = queryClient.getQueryData(['drafts']);

      // Optimistically update to remove the draft
      queryClient.setQueryData(['drafts'], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            drafts: page.drafts.filter((draft: EnrichedDraft) => draft.id !== draftId),
          })),
        };
      });

      // Return context with previous value for potential rollback
      return { previousDrafts };
    },
    onError: (_error, _draftId, context) => {
      // Rollback on error
      if (context?.previousDrafts) {
        queryClient.setQueryData(['drafts'], context.previousDrafts);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

/**
 * Hook to get draft count
 */
export function useDraftCount() {
  const { data } = useDrafts();

  const count =
    data?.pages.reduce((total, page) => total + (page.drafts?.length || 0), 0) || 0;

  return count;
}
