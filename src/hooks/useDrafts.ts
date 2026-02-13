import { AtpAgent } from "@atproto/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureMediaCachePopulated } from "../services/drafts/draft-media-storage.web";
import {
  migrateOldDrafts,
  needsMigration,
} from "../services/drafts/draft-migration";
import {
  ComposerState,
  EnrichedDraft,
  cleanupOrphanedMedia,
  createDraft,
  deleteDraft,
  draftToComposerState,
  getDrafts,
  updateDraft,
} from "../services/drafts/official-draft-service";

const DRAFT_QUERY_KEY = ["drafts"];

/**
 * Hook to get all drafts
 */
export function useDrafts(agent: AtpAgent | null, enabled: boolean = true) {
  return useQuery({
    queryKey: DRAFT_QUERY_KEY,
    queryFn: async () => {
      if (!agent) {
        throw new Error("Agent not initialized");
      }

      // Ensure media cache is populated
      await ensureMediaCachePopulated();

      // Check if migration is needed
      if (needsMigration()) {
        console.log("Old drafts detected, running migration...");
        const result = await migrateOldDrafts(agent);
        console.log("Migration result:", result);
      }

      // Get all drafts from official API
      const allDrafts: EnrichedDraft[] = [];
      let cursor: string | undefined;

      do {
        const { drafts, cursor: nextCursor } = await getDrafts(agent, cursor);
        allDrafts.push(...drafts);
        cursor = nextCursor;
      } while (cursor);

      // Sort by creation date (most recent first)
      allDrafts.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });

      return allDrafts;
    },
    enabled: enabled && !!agent,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to create a new draft
 */
export function useCreateDraft(agent: AtpAgent | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (state: ComposerState) => {
      if (!agent) {
        throw new Error("Agent not initialized");
      }
      return createDraft(agent, state);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFT_QUERY_KEY });
    },
  });
}

/**
 * Hook to update an existing draft
 */
export function useUpdateDraft(agent: AtpAgent | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draftId,
      state,
      originalLocalRefs,
    }: {
      draftId: string;
      state: ComposerState;
      originalLocalRefs?: string[];
    }) => {
      if (!agent) {
        throw new Error("Agent not initialized");
      }
      return updateDraft(agent, draftId, state, originalLocalRefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFT_QUERY_KEY });
    },
  });
}

/**
 * Hook to delete a draft
 */
export function useDeleteDraft(agent: AtpAgent | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draftId,
      localRefs,
    }: {
      draftId: string;
      localRefs?: string[];
    }) => {
      if (!agent) {
        throw new Error("Agent not initialized");
      }
      return deleteDraft(agent, draftId, localRefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRAFT_QUERY_KEY });
    },
  });
}

/**
 * Hook to load a draft into composer state
 */
export function useLoadDraft() {
  return useMutation({
    mutationFn: async (draft: EnrichedDraft) => {
      return draftToComposerState(draft);
    },
  });
}

/**
 * Hook to cleanup orphaned media
 */
export function useCleanupOrphanedMedia(agent: AtpAgent | null) {
  return useMutation({
    mutationFn: async () => {
      if (!agent) {
        throw new Error("Agent not initialized");
      }
      return cleanupOrphanedMedia(agent);
    },
  });
}

/**
 * Hook to get draft count
 */
export function useDraftCount(agent: AtpAgent | null, enabled: boolean = true) {
  const { data: drafts } = useDrafts(agent, enabled);
  return drafts?.length || 0;
}
