import { AppBskyFeedDefs } from '@atproto/api';
import { getAtProtoClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

import { createLogger } from '../../utils/logger';

const logger = createLogger('Bookmarks');
import {
  BookmarkCollection,
  bookmarkCollectionStorage
} from '../bookmark-collections';

const BOOKMARKS_STORAGE_KEY = '@shadowsky/bookmarks';

/** Maximum number of post URIs per getPosts() call (AT Protocol limit) */
const BATCH_SIZE = 25;

/**
 * Fetch posts in batches using getPosts() API instead of individual getPostThread() calls.
 * Chunks URIs into groups of 25 (API limit) and fetches batches concurrently.
 * Returns a Map of URI -> PostView for quick lookup.
 */
async function fetchPostsBatched(
  uris: string[]
): Promise<Map<string, AppBskyFeedDefs.PostView>> {
  if (uris.length === 0) return new Map();

  const client = getAtProtoClient();
  const agent = client.getAgent();
  const postMap = new Map<string, AppBskyFeedDefs.PostView>();

  // Chunk URIs into batches of BATCH_SIZE
  const batches: string[][] = [];
  for (let i = 0; i < uris.length; i += BATCH_SIZE) {
    batches.push(uris.slice(i, i + BATCH_SIZE));
  }

  // Fetch all batches concurrently
  const results = await Promise.all(
    batches.map((batch) =>
      rateLimited(
        async () => agent.getPosts({ uris: batch }),
        ATProtoEndpointType.FEED
      ).catch((error) => {
        logger.error('Failed to fetch batch of posts:', error);
        return null;
      })
    )
  );

  for (const result of results) {
    if (result?.data?.posts) {
      for (const post of result.data.posts) {
        postMap.set(post.uri, post);
      }
    }
  }

  return postMap;
}

export interface Bookmark {
  postUri: string;
  createdAt: string;
}

export interface BookmarkPost extends Bookmark {
  post?: AppBskyFeedDefs.PostView;
}

/**
 * Bookmark view from the official AT Protocol API
 */
interface BookmarkView {
  subject: {
    uri: string;
    cid: string;
  };
  createdAt?: string;
  item?: AppBskyFeedDefs.PostView & { $type?: string };
}

/**
 * Check if the official bookmarks API is available
 */
async function hasOfficialApi(): Promise<boolean> {
  try {
    const client = getAtProtoClient();
    if (!client.isAuthenticated()) return false;
    const agent = client.getAgent();
    // Check if the bookmark namespace exists on the agent
    return !!(agent.app?.bsky?.bookmark?.getBookmarks);
  } catch {
    return false;
  }
}

/**
 * Get all bookmarks - tries official API first, falls back to AsyncStorage
 */
export async function getBookmarks(): Promise<BookmarkPost[]> {
  try {
    const useOfficial = await hasOfficialApi();

    if (useOfficial) {
      return await getBookmarksFromApi();
    }

    return await getBookmarksFromStorage();
  } catch (error) {
    logger.error('Failed to get bookmarks from API, falling back to storage:', error);
    return await getBookmarksFromStorage();
  }
}

/**
 * Get bookmarks from the official AT Protocol API
 */
async function getBookmarksFromApi(): Promise<BookmarkPost[]> {
  const client = getAtProtoClient();
  const agent = client.getAgent();
  const allBookmarks: BookmarkPost[] = [];
  let cursor: string | undefined;

  do {
    const response = await rateLimited(
      async () => agent.app.bsky.bookmark.getBookmarks({
        limit: 100,
        cursor,
      }),
      ATProtoEndpointType.FEED
    );

    if (response.data.bookmarks.length > 0) {
      for (const bookmarkView of response.data.bookmarks as BookmarkView[]) {
        const uri = bookmarkView.subject.uri;
        const createdAt = bookmarkView.createdAt || new Date().toISOString();

        if (
          bookmarkView.item &&
          bookmarkView.item.$type === 'app.bsky.feed.defs#postView'
        ) {
          allBookmarks.push({
            postUri: uri,
            createdAt,
            post: bookmarkView.item as AppBskyFeedDefs.PostView,
          });
        } else {
          // Include bookmark even without full post data
          allBookmarks.push({
            postUri: uri,
            createdAt,
          });
        }
      }
      cursor = response.data.cursor;
    } else {
      cursor = undefined;
    }
  } while (cursor);

  // Sync to local storage for offline access
  const localBookmarks = allBookmarks.map(b => ({
    postUri: b.postUri,
    createdAt: b.createdAt,
  }));
  await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(localBookmarks));

  return allBookmarks;
}

/**
 * Get bookmarks from local AsyncStorage (fallback)
 */
async function getBookmarksFromStorage(): Promise<BookmarkPost[]> {
  const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  const bookmarks: Bookmark[] = JSON.parse(stored);
  const postMap = await fetchPostsBatched(bookmarks.map((b) => b.postUri));

  return bookmarks.map((bookmark) => ({
    ...bookmark,
    post: postMap.get(bookmark.postUri),
  }));
}

/**
 * Check if a post is bookmarked
 */
export async function isBookmarked(postUri: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!stored) {
      return false;
    }

    const bookmarks: Bookmark[] = JSON.parse(stored);
    return bookmarks.some((b) => b.postUri === postUri);
  } catch (error) {
    logger.error('Failed to check bookmark:', error);
    return false;
  }
}

/**
 * Add a post to bookmarks
 */
export async function addBookmark(post: AppBskyFeedDefs.PostView): Promise<void> {
  try {
    // Try official API first
    const useOfficial = await hasOfficialApi();
    if (useOfficial) {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      await rateLimited(
        async () => agent.app.bsky.bookmark.createBookmark({
          uri: post.uri,
          cid: post.cid,
        }),
        ATProtoEndpointType.RECORD
      );
    }

    // Always update local storage for offline access and fast lookups
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const bookmarks: Bookmark[] = stored ? JSON.parse(stored) : [];

    if (bookmarks.some((b) => b.postUri === post.uri)) {
      return;
    }

    bookmarks.unshift({
      postUri: post.uri,
      createdAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    logger.error('Failed to add bookmark:', error);
    throw error;
  }
}

/**
 * Remove a post from bookmarks
 */
export async function removeBookmark(postUri: string): Promise<void> {
  try {
    // Try official API first
    const useOfficial = await hasOfficialApi();
    if (useOfficial) {
      const client = getAtProtoClient();
      const agent = client.getAgent();
      await rateLimited(
        async () => agent.app.bsky.bookmark.deleteBookmark({
          uri: postUri,
        }),
        ATProtoEndpointType.RECORD
      );
    }

    // Always update local storage
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (stored) {
      const bookmarks: Bookmark[] = JSON.parse(stored);
      const filtered = bookmarks.filter((b) => b.postUri !== postUri);
      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(filtered));
    }

    // Also remove from all collections
    await bookmarkCollectionStorage.removeBookmarkFromAllCollections(postUri);
  } catch (error) {
    logger.error('Failed to remove bookmark:', error);
    throw error;
  }
}

/**
 * Toggle bookmark for a post
 */
export async function toggleBookmark(post: AppBskyFeedDefs.PostView): Promise<boolean> {
  const bookmarked = await isBookmarked(post.uri);

  if (bookmarked) {
    await removeBookmark(post.uri);
    return false;
  } else {
    await addBookmark(post);
    return true;
  }
}

/**
 * Clear all bookmarks
 */
export async function clearAllBookmarks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BOOKMARKS_STORAGE_KEY);
  } catch (error) {
    logger.error('Failed to clear bookmarks:', error);
    throw error;
  }
}

/**
 * Get the count of bookmarks from local storage
 */
export async function getBookmarkCount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!stored) {
      return 0;
    }
    const bookmarks: Bookmark[] = JSON.parse(stored);
    return bookmarks.length;
  } catch (error) {
    logger.error('Failed to get bookmark count:', error);
    return 0;
  }
}

// ==================== Collection Methods ====================

/**
 * Create a new collection
 */
export async function createCollection(
  collection: Omit<
    BookmarkCollection,
    'id' | 'createdAt' | 'updatedAt' | 'bookmarkCount'
  >
): Promise<BookmarkCollection> {
  return bookmarkCollectionStorage.createCollection(collection);
}

/**
 * Get a collection by ID
 */
export async function getCollection(id: string): Promise<BookmarkCollection | null> {
  return bookmarkCollectionStorage.getCollection(id);
}

/**
 * Get all collections
 */
export async function getAllCollections(): Promise<BookmarkCollection[]> {
  return bookmarkCollectionStorage.getAllCollections();
}

/**
 * Update a collection
 */
export async function updateCollection(
  id: string,
  updates: Partial<Omit<BookmarkCollection, 'id' | 'createdAt' | 'bookmarkCount'>>
): Promise<BookmarkCollection | null> {
  return bookmarkCollectionStorage.updateCollection(id, updates);
}

/**
 * Delete a collection
 */
export async function deleteCollection(id: string): Promise<void> {
  return bookmarkCollectionStorage.deleteCollection(id);
}

/**
 * Add a bookmark to a collection
 */
export async function addBookmarkToCollection(
  postUri: string,
  collectionId: string
): Promise<void> {
  return bookmarkCollectionStorage.addBookmarkToCollection(postUri, collectionId);
}

/**
 * Remove a bookmark from a collection
 */
export async function removeBookmarkFromCollection(
  postUri: string,
  collectionId: string
): Promise<void> {
  return bookmarkCollectionStorage.removeBookmarkFromCollection(postUri, collectionId);
}

/**
 * Get all collection IDs that a bookmark belongs to
 */
export async function getBookmarkCollections(postUri: string): Promise<string[]> {
  return bookmarkCollectionStorage.getBookmarkCollections(postUri);
}

/**
 * Get all bookmarks in a collection
 */
export async function getBookmarksInCollection(collectionId: string): Promise<BookmarkPost[]> {
  const bookmarkUris = await bookmarkCollectionStorage.getCollectionBookmarks(collectionId);
  const postMap = await fetchPostsBatched(bookmarkUris);

  return bookmarkUris
    .filter((uri) => postMap.has(uri))
    .map((uri) => ({
      postUri: uri,
      createdAt: new Date().toISOString(),
      post: postMap.get(uri),
    }));
}

/**
 * Get uncategorized bookmarks (not in any collection)
 */
export async function getUncategorizedBookmarks(): Promise<BookmarkPost[]> {
  const allBookmarks = await getBookmarks();
  const allUris = allBookmarks.map((b) => b.postUri);
  const uncategorizedUris = await bookmarkCollectionStorage.getUncategorizedBookmarks(allUris);

  return allBookmarks.filter((b) => uncategorizedUris.includes(b.postUri));
}

/**
 * Export collections and mappings
 */
export async function exportCollections() {
  return bookmarkCollectionStorage.exportData();
}

/**
 * Import collections and mappings
 */
export async function importCollections(data: {
  collections: BookmarkCollection[];
  mappings: any[];
}) {
  return bookmarkCollectionStorage.importData(data);
}
