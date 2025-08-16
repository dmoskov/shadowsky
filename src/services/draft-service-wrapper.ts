import { createLogger } from "../utils/logger";
import { draftService } from "./draft-service";
import { ThreadDraft } from "./drafts";

const logger = createLogger("DraftServiceWrapper");

/**
 * Wrapper functions that maintain backward compatibility with the existing draft API
 * while using the new draft service with storage backend support
 */

export const saveDraft = async (draft: ThreadDraft): Promise<void> => {
  try {
    const existingDraft = await draftService.getDraft(draft.id);

    if (existingDraft) {
      // Update existing draft
      await draftService.updateDraft(draft.id, {
        ...draft,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create new draft
      await draftService.createDraft({
        ...draft,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("Failed to save draft:", error);
    throw error;
  }
};

export const getDrafts = async (): Promise<ThreadDraft[]> => {
  try {
    return await draftService.getDrafts();
  } catch (error) {
    logger.error("Failed to get drafts:", error);
    return [];
  }
};

export const getDraft = async (id: string): Promise<ThreadDraft | null> => {
  try {
    const draft = await draftService.getDraft(id);
    return draft || null;
  } catch (error) {
    logger.error("Failed to get draft:", error);
    return null;
  }
};

export const deleteDraft = async (id: string): Promise<void> => {
  try {
    await draftService.deleteDraft(id);
  } catch (error) {
    logger.error("Failed to delete draft:", error);
    throw error;
  }
};

// Re-export utility functions that don't need modification
export { generateDraftId } from "./drafts";
