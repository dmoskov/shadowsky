import { AtpAgent } from "@atproto/api";
import { ThreadDraft } from "../drafts";
import { ComposerState, createDraft } from "./official-draft-service";

/**
 * Migration status stored in localStorage
 */
interface MigrationStatus {
  migrated: boolean;
  migratedAt?: string;
  oldDraftsCount?: number;
  migratedDraftsCount?: number;
  backupCreated?: boolean;
}

const MIGRATION_STATUS_KEY = "bsky_draft_migration_status";
const OLD_DRAFTS_BACKUP_KEY = "bsky_drafts_backup";
const DRAFTS_KEY = "bsky_thread_drafts";

/**
 * Get migration status
 */
export function getMigrationStatus(): MigrationStatus {
  try {
    const status = localStorage.getItem(MIGRATION_STATUS_KEY);
    return status
      ? JSON.parse(status)
      : { migrated: false, backupCreated: false };
  } catch {
    return { migrated: false, backupCreated: false };
  }
}

/**
 * Set migration status
 */
function setMigrationStatus(status: MigrationStatus): void {
  localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status));
}

/**
 * Get old drafts from localStorage
 */
function getOldDrafts(): ThreadDraft[] {
  try {
    const drafts = localStorage.getItem(DRAFTS_KEY);
    return drafts ? JSON.parse(drafts) : [];
  } catch {
    return [];
  }
}

/**
 * Create backup of old drafts
 */
function backupOldDrafts(drafts: ThreadDraft[]): void {
  try {
    localStorage.setItem(OLD_DRAFTS_BACKUP_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Failed to backup old drafts:", error);
    throw new Error("Failed to create backup of old drafts");
  }
}

/**
 * Convert old ThreadDraft to new ComposerState format
 */
function threadDraftToComposerState(oldDraft: ThreadDraft): ComposerState {
  const state: ComposerState = {
    text: oldDraft.content,
  };

  // Handle images (legacy format)
  if (oldDraft.images && oldDraft.images.length > 0) {
    state.images = oldDraft.images.map((img) => ({
      uri: img.file, // base64 or blob URL
      altText: img.alt,
      mimeType: "image/jpeg", // Default, will be inferred from data URL if present
    }));
  }

  // Handle media (new format with videos)
  if (oldDraft.media && oldDraft.media.length > 0) {
    const images = oldDraft.media.filter((m) => m.type === "image");
    const videos = oldDraft.media.filter((m) => m.type === "video");

    if (images.length > 0) {
      state.images = images.map((img) => ({
        uri: img.file,
        altText: img.alt,
        mimeType: "image/jpeg",
      }));
    }

    if (videos.length > 0) {
      state.videos = videos.map((video) => ({
        uri: video.file,
        mimeType: "video/mp4", // Default
      }));
    }
  }

  return state;
}

/**
 * Migrate a single old draft to the new official format
 */
async function migrateOldDraft(
  agent: AtpAgent,
  oldDraft: ThreadDraft,
): Promise<string | null> {
  try {
    // Skip scheduled drafts for now - they're handled by scheduled posts service
    if (oldDraft.scheduledFor) {
      console.log(`Skipping scheduled draft: ${oldDraft.id}`);
      return null;
    }

    // Skip empty drafts
    if (!oldDraft.content || oldDraft.content.trim() === "") {
      console.log(`Skipping empty draft: ${oldDraft.id}`);
      return null;
    }

    // Convert to composer state
    const composerState = threadDraftToComposerState(oldDraft);

    // Create new draft using official API
    const newDraftId = await createDraft(agent, composerState);

    console.log(
      `Migrated draft "${oldDraft.title}" (${oldDraft.id}) to ${newDraftId}`,
    );

    return newDraftId;
  } catch (error) {
    console.error(`Failed to migrate draft ${oldDraft.id}:`, error);
    return null;
  }
}

/**
 * Migrate all old drafts to the new official format
 */
export async function migrateOldDrafts(agent: AtpAgent): Promise<{
  success: boolean;
  totalDrafts: number;
  migratedDrafts: number;
  skippedDrafts: number;
  failedDrafts: number;
  error?: string;
}> {
  // Check if already migrated
  const status = getMigrationStatus();
  if (status.migrated) {
    console.log("Drafts already migrated");
    return {
      success: true,
      totalDrafts: status.oldDraftsCount || 0,
      migratedDrafts: status.migratedDraftsCount || 0,
      skippedDrafts: 0,
      failedDrafts: 0,
    };
  }

  // Get old drafts
  const oldDrafts = getOldDrafts();

  if (oldDrafts.length === 0) {
    console.log("No old drafts to migrate");
    setMigrationStatus({
      migrated: true,
      migratedAt: new Date().toISOString(),
      oldDraftsCount: 0,
      migratedDraftsCount: 0,
      backupCreated: false,
    });
    return {
      success: true,
      totalDrafts: 0,
      migratedDrafts: 0,
      skippedDrafts: 0,
      failedDrafts: 0,
    };
  }

  try {
    // Create backup before migration
    backupOldDrafts(oldDrafts);
    console.log(`Created backup of ${oldDrafts.length} old drafts`);

    // Migrate each draft
    const results = await Promise.allSettled(
      oldDrafts.map((draft) => migrateOldDraft(agent, draft)),
    );

    // Count results
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        if (result.value === null) {
          skippedCount++;
        } else {
          migratedCount++;
        }
      } else {
        failedCount++;
      }
    });

    console.log(
      `Migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${failedCount} failed`,
    );

    // Mark as migrated
    setMigrationStatus({
      migrated: true,
      migratedAt: new Date().toISOString(),
      oldDraftsCount: oldDrafts.length,
      migratedDraftsCount: migratedCount,
      backupCreated: true,
    });

    return {
      success: true,
      totalDrafts: oldDrafts.length,
      migratedDrafts: migratedCount,
      skippedDrafts: skippedCount,
      failedDrafts: failedCount,
    };
  } catch (error) {
    console.error("Migration failed:", error);
    return {
      success: false,
      totalDrafts: oldDrafts.length,
      migratedDrafts: 0,
      skippedDrafts: 0,
      failedDrafts: oldDrafts.length,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if migration is needed
 */
export function needsMigration(): boolean {
  const status = getMigrationStatus();
  if (status.migrated) {
    return false;
  }

  const oldDrafts = getOldDrafts();
  return oldDrafts.length > 0;
}

/**
 * Clear old drafts from localStorage (after migration period)
 */
export function clearOldDrafts(): void {
  try {
    localStorage.removeItem(DRAFTS_KEY);
    console.log("Cleared old drafts from localStorage");
  } catch (error) {
    console.error("Failed to clear old drafts:", error);
  }
}

/**
 * Restore old drafts from backup (rollback mechanism)
 */
export function restoreOldDraftsFromBackup(): boolean {
  try {
    const backup = localStorage.getItem(OLD_DRAFTS_BACKUP_KEY);
    if (!backup) {
      console.log("No backup found");
      return false;
    }

    localStorage.setItem(DRAFTS_KEY, backup);
    console.log("Restored old drafts from backup");

    // Reset migration status
    setMigrationStatus({
      migrated: false,
      backupCreated: false,
    });

    return true;
  } catch (error) {
    console.error("Failed to restore old drafts:", error);
    return false;
  }
}
