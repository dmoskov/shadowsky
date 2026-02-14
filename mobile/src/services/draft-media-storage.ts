import * as FileSystem from 'expo-file-system';
import { nanoid } from 'nanoid';


import { createLogger } from '../utils/logger';

const logger = createLogger('DraftMediaStorage');
/**
 * Media storage for drafts using expo-file-system
 * Media is stored locally on-device and referenced by abstract localRefPath identifiers
 */

const DRAFT_MEDIA_DIR = FileSystem.documentDirectory + 'bsky-draft-media/';

// Cache to avoid repeated filesystem checks
const mediaExistenceCache = new Map<string, boolean>();

/**
 * Generate a unique localRefPath for an image
 */
export function generateImageRefPath(): string {
  return `image:${nanoid()}`;
}

/**
 * Generate a unique localRefPath for a video
 */
export function generateVideoRefPath(mimeType: string): string {
  const ext = mimeType.split('/')[1] || 'mp4';
  return `video:${mimeType}:${nanoid()}.${ext}`;
}

/**
 * Initialize the draft media directory
 */
async function ensureMediaDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DRAFT_MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAFT_MEDIA_DIR, { intermediates: true });
  }
}

/**
 * Convert localRefPath to filesystem path
 */
function getFilePath(localRefPath: string): string {
  // Sanitize the localRefPath to create a valid filename
  const sanitized = localRefPath.replace(/[:/\\]/g, '_');
  return DRAFT_MEDIA_DIR + sanitized;
}

/**
 * Save media file to local storage
 * @param localRefPath - The unique identifier for this media file
 * @param sourceUri - The URI of the source file to copy
 * @returns The local file URI
 */
export async function saveMediaToLocal(
  localRefPath: string,
  sourceUri: string
): Promise<string> {
  await ensureMediaDirectory();

  const destPath = getFilePath(localRefPath);

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destPath,
  });

  // Update cache
  mediaExistenceCache.set(localRefPath, true);

  return destPath;
}

/**
 * Load media file from local storage
 * @param localRefPath - The unique identifier for this media file
 * @returns The local file URI, or null if not found
 */
export async function loadMediaFromLocal(
  localRefPath: string
): Promise<string | null> {
  const filePath = getFilePath(localRefPath);
  const info = await FileSystem.getInfoAsync(filePath);

  if (info.exists) {
    mediaExistenceCache.set(localRefPath, true);
    return filePath;
  }

  mediaExistenceCache.set(localRefPath, false);
  return null;
}

/**
 * Delete media file from local storage
 * @param localRefPath - The unique identifier for this media file
 */
export async function deleteMediaFromLocal(localRefPath: string): Promise<void> {
  const filePath = getFilePath(localRefPath);
  const info = await FileSystem.getInfoAsync(filePath);

  if (info.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }

  // Remove from cache
  mediaExistenceCache.delete(localRefPath);
}

/**
 * Check if media file exists locally (with caching)
 * @param localRefPath - The unique identifier for this media file
 * @returns True if the file exists locally
 */
export async function mediaExists(localRefPath: string): Promise<boolean> {
  // Check cache first
  if (mediaExistenceCache.has(localRefPath)) {
    return mediaExistenceCache.get(localRefPath)!;
  }

  // Check filesystem
  const filePath = getFilePath(localRefPath);
  const info = await FileSystem.getInfoAsync(filePath);

  // Update cache
  mediaExistenceCache.set(localRefPath, info.exists);

  return info.exists;
}

/**
 * Populate the media existence cache by scanning the directory
 * Should be called on app startup
 */
export async function ensureMediaCachePopulated(): Promise<void> {
  try {
    await ensureMediaDirectory();
    const files = await FileSystem.readDirectoryAsync(DRAFT_MEDIA_DIR);

    // Pre-populate cache with all existing files
    for (const fileName of files) {
      // Reverse sanitization to get original localRefPath
      const localRefPath = fileName.replace(/_/g, ':');
      mediaExistenceCache.set(localRefPath, true);
    }
  } catch (error) {
    logger.error('Failed to populate media cache:', error);
  }
}

/**
 * Delete all media files for a list of localRefPaths
 * @param localRefPaths - Array of localRefPath identifiers
 */
export async function deleteMultipleMedia(localRefPaths: string[]): Promise<void> {
  await Promise.all(
    localRefPaths.map((refPath) => deleteMediaFromLocal(refPath))
  );
}

/**
 * Get all stored media files (for cleanup/debugging)
 */
export async function getAllStoredMedia(): Promise<string[]> {
  try {
    await ensureMediaDirectory();
    const files = await FileSystem.readDirectoryAsync(DRAFT_MEDIA_DIR);
    return files.map((fileName) => fileName.replace(/_/g, ':'));
  } catch (error) {
    logger.error('Failed to get stored media:', error);
    return [];
  }
}

/**
 * Clear all draft media (useful for cleanup)
 */
export async function clearAllDraftMedia(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DRAFT_MEDIA_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(DRAFT_MEDIA_DIR, { idempotent: true });
      mediaExistenceCache.clear();
    }
  } catch (error) {
    logger.error('Failed to clear draft media:', error);
  }
}
