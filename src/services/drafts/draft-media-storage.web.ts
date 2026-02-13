import { createStore, del, get, keys, set } from "idb-keyval";
import { nanoid } from "nanoid";

/**
 * Media storage for drafts using IndexedDB via idb-keyval
 * Media is stored locally in IndexedDB and referenced by abstract localRefPath identifiers
 */

// Create a custom store for draft media
const draftMediaStore = createStore("bsky-draft-media", "media");

// Cache to avoid repeated IndexedDB lookups
const mediaExistenceCache = new Map<string, boolean>();

// Track blob URLs to prevent memory leaks
const blobUrlCache = new Map<string, string>();

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
  const ext = mimeType.split("/")[1] || "mp4";
  return `video:${mimeType}:${nanoid()}.${ext}`;
}

/**
 * Convert a data URL or blob URL to a Blob
 */
async function uriToBlob(uri: string): Promise<Blob> {
  // If it's already a blob URL, fetch it
  if (uri.startsWith("blob:")) {
    const response = await fetch(uri);
    return response.blob();
  }

  // If it's a data URL, convert it
  if (uri.startsWith("data:")) {
    const response = await fetch(uri);
    return response.blob();
  }

  // If it's an HTTP URL, fetch it
  if (uri.startsWith("http:") || uri.startsWith("https:")) {
    const response = await fetch(uri);
    return response.blob();
  }

  throw new Error(`Unsupported URI format: ${uri}`);
}

/**
 * Save media file to IndexedDB
 * @param localRefPath - The unique identifier for this media file
 * @param sourceUri - The URI of the source file (data URL, blob URL, or HTTP URL)
 * @returns The blob URL for the saved media
 */
export async function saveMediaToLocal(
  localRefPath: string,
  sourceUri: string,
): Promise<string> {
  try {
    // Convert URI to Blob
    const blob = await uriToBlob(sourceUri);

    // Store in IndexedDB
    await set(localRefPath, blob, draftMediaStore);

    // Update cache
    mediaExistenceCache.set(localRefPath, true);

    // Create and cache blob URL
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(localRefPath, blobUrl);

    return blobUrl;
  } catch (error) {
    console.error("Failed to save media to local storage:", error);
    throw error;
  }
}

/**
 * Load media file from IndexedDB
 * @param localRefPath - The unique identifier for this media file
 * @returns The blob URL for the media, or null if not found
 */
export async function loadMediaFromLocal(
  localRefPath: string,
): Promise<string | null> {
  try {
    // Check if we already have a blob URL cached
    if (blobUrlCache.has(localRefPath)) {
      return blobUrlCache.get(localRefPath)!;
    }

    // Load from IndexedDB
    const blob = await get<Blob>(localRefPath, draftMediaStore);

    if (!blob) {
      mediaExistenceCache.set(localRefPath, false);
      return null;
    }

    mediaExistenceCache.set(localRefPath, true);

    // Create and cache blob URL
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(localRefPath, blobUrl);

    return blobUrl;
  } catch (error) {
    console.error("Failed to load media from local storage:", error);
    mediaExistenceCache.set(localRefPath, false);
    return null;
  }
}

/**
 * Delete media file from IndexedDB
 * @param localRefPath - The unique identifier for this media file
 */
export async function deleteMediaFromLocal(
  localRefPath: string,
): Promise<void> {
  try {
    // Revoke blob URL if cached
    const blobUrl = blobUrlCache.get(localRefPath);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrlCache.delete(localRefPath);
    }

    // Delete from IndexedDB
    await del(localRefPath, draftMediaStore);

    // Remove from cache
    mediaExistenceCache.delete(localRefPath);
  } catch (error) {
    console.error("Failed to delete media from local storage:", error);
    throw error;
  }
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

  // Check IndexedDB
  try {
    const blob = await get<Blob>(localRefPath, draftMediaStore);
    const exists = blob !== undefined;

    // Update cache
    mediaExistenceCache.set(localRefPath, exists);

    return exists;
  } catch (error) {
    console.error("Failed to check media existence:", error);
    mediaExistenceCache.set(localRefPath, false);
    return false;
  }
}

/**
 * Populate the media existence cache by scanning IndexedDB
 * Should be called on app startup
 */
export async function ensureMediaCachePopulated(): Promise<void> {
  try {
    const allKeys = await keys(draftMediaStore);

    // Pre-populate cache with all existing files
    for (const key of allKeys) {
      if (typeof key === "string") {
        mediaExistenceCache.set(key, true);
      }
    }
  } catch (error) {
    console.error("Failed to populate media cache:", error);
  }
}

/**
 * Delete all media files for a list of localRefPaths
 * @param localRefPaths - Array of localRefPath identifiers
 */
export async function deleteMultipleMedia(
  localRefPaths: string[],
): Promise<void> {
  await Promise.all(localRefPaths.map((path) => deleteMediaFromLocal(path)));
}

/**
 * Clean up all cached blob URLs
 * Should be called when app is shutting down or refreshing
 */
export function cleanupBlobUrls(): void {
  for (const blobUrl of blobUrlCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlCache.clear();
}

/**
 * Get all media keys from IndexedDB
 * Useful for debugging or cleanup operations
 */
export async function getAllMediaKeys(): Promise<string[]> {
  try {
    const allKeys = await keys(draftMediaStore);
    return allKeys.filter((key) => typeof key === "string") as string[];
  } catch (error) {
    console.error("Failed to get all media keys:", error);
    return [];
  }
}
