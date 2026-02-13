import { AppBskyFeedDefs } from '@atproto/api';
import { getAtProtoClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';
import {
  BookmarkCollection,
  bookmarkCollectionStorage
} from '../bookmark-collections';

const BOOKMARKS_STORAGE_KEY = '@shadowsky/bookmarks';

export interface Bookmark {
  postUri: string;
  createdAt: string;
}

export interface BookmarkPost extends Bookmark {
  post?: AppBskyFeedDefs.PostView;
}

/**
 * Get all bookmarks from local storage
 */
export async function getBookmarks(): Promise<BookmarkPost[]> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const bookmarks: Bookmark[] = JSON.parse(stored);
    const client = getAtProtoClient();
    const agent = client.getAgent();

    // Fetch post data for each bookmark
    const bookmarkPosts: BookmarkPost[] = [];
    for (const bookmark of bookmarks) {
      try {
        const response = await rateLimited(
          async () => agent.getPostThread({
            uri: bookmark.postUri,
          }),
          ATProtoEndpointType.FEED
        );

        if (response.data.thread && 'post' in response.data.thread) {
          bookmarkPosts.push({
            ...bookmark,
            post: response.data.thread.post as AppBskyFeedDefs.PostView,
          });
        } else {
          // Include bookmark even if post couldn't be fetched
          bookmarkPosts.push(bookmark);
        }
      } catch (error) {
        console.error('Failed to fetch bookmarked post:', error);
        // Include bookmark even if post fetch failed
        bookmarkPosts.push(bookmark);
      }
    }

    return bookmarkPosts;
  } catch (error) {
    console.error('Failed to get bookmarks:', error);
    return [];
  }
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
    console.error('Failed to check bookmark:', error);
    return false;
  }
}

/**
 * Add a post to bookmarks
 */
export async function addBookmark(post: AppBskyFeedDefs.PostView): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const bookmarks: Bookmark[] = stored ? JSON.parse(stored) : [];

    // Check if already bookmarked
    if (bookmarks.some((b) => b.postUri === post.uri)) {
      return;
    }

    // Add new bookmark
    bookmarks.unshift({
      postUri: post.uri,
      createdAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Failed to add bookmark:', error);
    throw error;
  }
}

/**
 * Remove a post from bookmarks
 */
export async function removeBookmark(postUri: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const bookmarks: Bookmark[] = JSON.parse(stored);
    const filtered = bookmarks.filter((b) => b.postUri !== postUri);

    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(filtered));

    // Also remove from all collections
    await bookmarkCollectionStorage.removeBookmarkFromAllCollections(postUri);
  } catch (error) {
    console.error('Failed to remove bookmark:', error);
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
    console.error('Failed to clear bookmarks:', error);
    throw error;
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
  const client = getAtProtoClient();
  const agent = client.getAgent();

  const bookmarkPosts: BookmarkPost[] = [];
  for (const uri of bookmarkUris) {
    try {
      const response = await rateLimited(
        async () => agent.getPostThread({ uri }),
        ATProtoEndpointType.FEED
      );

      if (response.data.thread && 'post' in response.data.thread) {
        bookmarkPosts.push({
          postUri: uri,
          createdAt: new Date().toISOString(),
          post: response.data.thread.post as AppBskyFeedDefs.PostView,
        });
      }
    } catch (error) {
      console.error('Failed to fetch bookmarked post:', error);
    }
  }

  return bookmarkPosts;
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
