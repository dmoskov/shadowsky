import { File, Directory, Paths } from 'expo-file-system';
import { nanoid } from 'nanoid';


import { createLogger } from '../utils/logger';

const logger = createLogger('DraftMediaStorage');
/**
 * Media storage for drafts using expo-file-system
 * Media is stored locally on-device and referenced by abstract localRefPath identifiers
 */

// Use new expo-file-system API
const DRAFT_MEDIA_DIR = new Directory(Paths.document, 'bsky-draft-media');

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
  if (!(await DRAFT_MEDIA_DIR.exists)) {
    await DRAFT_MEDIA_DIR.create();
  }
}

/**
 * Convert localRefPath to filesystem path
 */
function getFile(localRefPath: string): File {
  // Sanitize the localRefPath to create a valid filename
  const sanitized = localRefPath.replace(/[:/\\]/g, '_');
  return new File(DRAFT_MEDIA_DIR, sanitized);
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

  const destFile = getFile(localRefPath);

  // Copy the file to our draft media directory
  const sourceFile = new File(sourceUri);
  await sourceFile.copy(destFile);

  // Update cache
  mediaExistenceCache.set(localRefPath, true);

  return destFile.uri;
}

/**
 * Load media file from local storage
 * @param localRefPath - The unique identifier for this media file
 * @returns The local file URI, or null if not found
 */
export async function loadMediaFromLocal(
  localRefPath: string
): Promise<string | null> {
  const file = getFile(localRefPath);

  if (await file.exists) {
    mediaExistenceCache.set(localRefPath, true);
    return file.uri;
  }

  mediaExistenceCache.set(localRefPath, false);
  return null;
}

/**
 * Delete media file from local storage
 * @param localRefPath - The unique identifier for this media file
 */
export async function deleteMediaFromLocal(localRefPath: string): Promise<void> {
  const file = getFile(localRefPath);

  if (await file.exists) {
    await file.delete();
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
  const file = getFile(localRefPath);
  const exists = await file.exists;

  // Update cache
  mediaExistenceCache.set(localRefPath, exists);

  return exists;
}

/**
 * Populate the media existence cache by scanning the directory
 * Should be called on app startup
 */
export async function ensureMediaCachePopulated(): Promise<void> {
  try {
    await ensureMediaDirectory();
    const files = await DRAFT_MEDIA_DIR.list();

    // Pre-populate cache with all existing files
    for (const file of files) {
      // Reverse sanitization to get original localRefPath
      const localRefPath = file.name.replace(/_/g, ':');
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
    const files = await DRAFT_MEDIA_DIR.list();
    return files.map((file) => file.name.replace(/_/g, ':'));
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
    if (await DRAFT_MEDIA_DIR.exists) {
      await DRAFT_MEDIA_DIR.delete();
      mediaExistenceCache.clear();
    }
  } catch (error) {
    logger.error('Failed to clear draft media:', error);
  }
}
