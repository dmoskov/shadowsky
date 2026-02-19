/**
 * Bookmark Collection Storage
 *
 * AsyncStorage-based storage for bookmark collections and their mappings.
 * Collections are synced to AT Protocol via com.shadowsky.bookmarkCollections
 * singleton record so they persist across devices and survive device wipes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookmarkCollection, BookmarkCollectionMapping } from './types';
import {
  fetchCollectionsFromServer,
  pushCollectionsToServer,
  mergeCollectionData,
} from './collection-sync';

import { createLogger } from '../../utils/logger';

const logger = createLogger('CollectionStorage');
const COLLECTIONS_KEY = '@shadowsky/bookmark_collections';
const MAPPINGS_KEY = '@shadowsky/bookmark_collection_mappings';

export class BookmarkCollectionStorage {
  private static instance: BookmarkCollectionStorage;

  private constructor() {}

  static getInstance(): BookmarkCollectionStorage {
    if (!BookmarkCollectionStorage.instance) {
      BookmarkCollectionStorage.instance = new BookmarkCollectionStorage();
    }
    return BookmarkCollectionStorage.instance;
  }

  // ==================== AT Proto Sync ====================

  /**
   * Fire-and-forget push of current local state to the AT Proto server.
   * Called after every mutating operation to keep the server in sync.
   */
  private syncToServer(): void {
    this.exportData()
      .then(({ collections, mappings }) => {
        return pushCollectionsToServer(collections, mappings);
      })
      .catch((error) => {
        logger.error('Background sync to server failed:', error);
      });
  }

  /**
   * Merge server collections with local on startup.
   * Fetches from AT Proto, merges with local data (union strategy),
   * writes merged result to both local and server.
   */
  async syncFromServer(): Promise<void> {
    const serverData = await fetchCollectionsFromServer();
    if (!serverData) return;

    const localData = await this.exportData();

    // If both are empty, nothing to do
    if (
      localData.collections.length === 0 &&
      localData.mappings.length === 0 &&
      serverData.collections.length === 0 &&
      serverData.mappings.length === 0
    ) {
      return;
    }

    const merged = mergeCollectionData(localData, serverData);

    // Write merged data to local storage
    await this.importData(merged);

    // Push merged result back to server
    pushCollectionsToServer(merged.collections, merged.mappings).catch(
      (error) => {
        logger.error('Failed to push merged data to server:', error);
      }
    );

    logger.log(
      `Synced collections from server: ${merged.collections.length} collections, ${merged.mappings.length} mappings`
    );
  }

  // ==================== Collection CRUD ====================

  async createCollection(
    collection: Omit<
      BookmarkCollection,
      'id' | 'createdAt' | 'updatedAt' | 'bookmarkCount'
    >
  ): Promise<BookmarkCollection> {
    const collections = await this.getAllCollections();
    const now = new Date().toISOString();
    const newCollection: BookmarkCollection = {
      ...collection,
      id: `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      bookmarkCount: 0,
    };

    collections.push(newCollection);
    await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));

    logger.log(`Created collection: ${newCollection.name}`);
    this.syncToServer();
    return newCollection;
  }

  async getCollection(id: string): Promise<BookmarkCollection | null> {
    const collections = await this.getAllCollections();
    return collections.find((c) => c.id === id) || null;
  }

  async getAllCollections(): Promise<BookmarkCollection[]> {
    try {
      const stored = await AsyncStorage.getItem(COLLECTIONS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      logger.error('Failed to get collections:', error);
      return [];
    }
  }

  async updateCollection(
    id: string,
    updates: Partial<
      Omit<BookmarkCollection, 'id' | 'createdAt' | 'bookmarkCount'>
    >
  ): Promise<BookmarkCollection | null> {
    const collections = await this.getAllCollections();
    const index = collections.findIndex((c) => c.id === id);

    if (index === -1) return null;

    const updated: BookmarkCollection = {
      ...collections[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    collections[index] = updated;
    await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));

    logger.log(`Updated collection: ${updated.name}`);
    this.syncToServer();
    return updated;
  }

  async deleteCollection(id: string): Promise<void> {
    const collections = await this.getAllCollections();
    const filtered = collections.filter((c) => c.id !== id);
    await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered));

    // Delete all mappings for this collection
    const mappings = await this.getAllMappings();
    const filteredMappings = mappings.filter((m) => m.collectionId !== id);
    await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(filteredMappings));

    logger.log(`Deleted collection: ${id}`);
    this.syncToServer();
  }

  // ==================== Bookmark-Collection Mappings ====================

  private async getAllMappings(): Promise<BookmarkCollectionMapping[]> {
    try {
      const stored = await AsyncStorage.getItem(MAPPINGS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      logger.error('Failed to get mappings:', error);
      return [];
    }
  }

  async addBookmarkToCollection(
    bookmarkUri: string,
    collectionId: string
  ): Promise<void> {
    const mappings = await this.getAllMappings();

    // Check if already exists
    const exists = mappings.some(
      (m) => m.bookmarkUri === bookmarkUri && m.collectionId === collectionId
    );

    if (!exists) {
      const mapping: BookmarkCollectionMapping = {
        bookmarkUri,
        collectionId,
        addedAt: new Date().toISOString(),
      };
      mappings.push(mapping);
      await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
    }

    // Update collection bookmark count
    await this.updateCollectionCounts();

    logger.log(`Added bookmark to collection: ${collectionId}`);
    this.syncToServer();
  }

  async removeBookmarkFromCollection(
    bookmarkUri: string,
    collectionId: string
  ): Promise<void> {
    const mappings = await this.getAllMappings();
    const filtered = mappings.filter(
      (m) => !(m.bookmarkUri === bookmarkUri && m.collectionId === collectionId)
    );
    await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(filtered));

    // Update collection bookmark count
    await this.updateCollectionCounts();

    logger.log(`Removed bookmark from collection: ${collectionId}`);
    this.syncToServer();
  }

  async removeBookmarkFromAllCollections(bookmarkUri: string): Promise<void> {
    const mappings = await this.getAllMappings();
    const filtered = mappings.filter((m) => m.bookmarkUri !== bookmarkUri);
    await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(filtered));

    // Update collection bookmark counts
    await this.updateCollectionCounts();

    logger.log(`Removed bookmark from all collections: ${bookmarkUri}`);
    this.syncToServer();
  }

  async getBookmarkCollections(bookmarkUri: string): Promise<string[]> {
    const mappings = await this.getAllMappings();
    return mappings
      .filter((m) => m.bookmarkUri === bookmarkUri)
      .map((m) => m.collectionId);
  }

  async getCollectionBookmarks(collectionId: string): Promise<string[]> {
    const mappings = await this.getAllMappings();
    return mappings
      .filter((m) => m.collectionId === collectionId)
      .map((m) => m.bookmarkUri);
  }

  async getCollectionBookmarkCount(collectionId: string): Promise<number> {
    const mappings = await this.getAllMappings();
    return mappings.filter((m) => m.collectionId === collectionId).length;
  }

  async getUncategorizedBookmarks(
    allBookmarkUris: string[]
  ): Promise<string[]> {
    const mappings = await this.getAllMappings();
    const categorizedUris = new Set(mappings.map((m) => m.bookmarkUri));
    return allBookmarkUris.filter((uri) => !categorizedUris.has(uri));
  }

  private async updateCollectionCounts(): Promise<void> {
    const collections = await this.getAllCollections();
    const mappings = await this.getAllMappings();

    const updated = collections.map((collection) => {
      const count = mappings.filter(
        (m) => m.collectionId === collection.id
      ).length;
      return {
        ...collection,
        bookmarkCount: count,
        updatedAt: new Date().toISOString(),
      };
    });

    await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
  }

  // ==================== Utility Methods ====================

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(COLLECTIONS_KEY);
    await AsyncStorage.removeItem(MAPPINGS_KEY);
    logger.log('Cleared all collection storage');
    this.syncToServer();
  }

  async exportData(): Promise<{
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  }> {
    const collections = await this.getAllCollections();
    const mappings = await this.getAllMappings();
    return { collections, mappings };
  }

  async importData(data: {
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  }): Promise<void> {
    await AsyncStorage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify(data.collections)
    );
    await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(data.mappings));
    logger.log('Imported collection data');
  }
}

export const bookmarkCollectionStorage =
  BookmarkCollectionStorage.getInstance();
