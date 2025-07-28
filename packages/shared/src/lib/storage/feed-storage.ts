/**
 * Feed and Post storage service using IndexedDB
 * Provides persistent storage for timeline feeds and individual posts
 */

import { IndexedDBStore, StorageConfig, Post, FeedItem, FeedPageMetadata, StorageMetadata } from './indexed-db-core'

const FEED_DB_CONFIG: StorageConfig = {
  dbName: 'BskyFeedStorage',
  version: 1,
  stores: [
    {
      name: 'posts',
      keyPath: 'uri',
      indexes: [
        { name: 'by_indexed_at', keyPath: 'indexedAt' },
        { name: 'by_author', keyPath: 'author.did' },
        { name: 'by_created_at', keyPath: 'record.createdAt' }
      ]
    },
    {
      name: 'feed_items',
      keyPath: 'post.uri',
      indexes: [
        { name: 'by_indexed_at', keyPath: 'post.indexedAt' },
        { name: 'by_reason', keyPath: 'reason.$type' },
        { name: 'by_feed_type', keyPath: '_feedType' }
      ]
    },
    {
      name: 'feed_pages',
      keyPath: 'id',
      indexes: [
        { name: 'by_feed_type', keyPath: 'feedType' },
        { name: 'by_timestamp', keyPath: 'timestamp' }
      ]
    },
    {
      name: 'metadata',
      keyPath: 'id'
    }
  ]
}

export interface FeedPage {
  id: string
  feedType: string
  cursor?: string
  timestamp: number
  postUris: string[]
}

export class FeedStorageService extends IndexedDBStore {
  private static instance: FeedStorageService
  
  private constructor() {
    super(FEED_DB_CONFIG)
  }
  
  static getInstance(): FeedStorageService {
    if (!FeedStorageService.instance) {
      FeedStorageService.instance = new FeedStorageService()
    }
    return FeedStorageService.instance
  }
  
  /**
   * Save a page of feed items
   */
  async saveFeedPage(
    feedType: string,
    items: FeedItem[],
    cursor?: string,
    pageId?: string
  ): Promise<string> {
    const db = this.ensureDb()
    const transaction = db.transaction(['feed_items', 'posts', 'feed_pages'], 'readwrite')
    
    const feedItemsStore = transaction.objectStore('feed_items')
    const postsStore = transaction.objectStore('posts')
    const pagesStore = transaction.objectStore('feed_pages')
    
    // Generate page ID if not provided
    const actualPageId = pageId || `${feedType}_${Date.now()}`
    const postUris: string[] = []
    
    // Save each feed item and its post
    for (const item of items) {
      // Add feed type metadata
      const enrichedItem = {
        ...item,
        _feedType: feedType,
        _cachedAt: Date.now()
      }
      
      feedItemsStore.put(enrichedItem)
      
      // Save the post separately for cross-feed access
      if (item.post) {
        postsStore.put({
          ...item.post,
          _cachedAt: Date.now()
        })
        postUris.push(item.post.uri)
      }
    }
    
    // Save page metadata
    const page: FeedPage = {
      id: actualPageId,
      feedType,
      cursor,
      timestamp: Date.now(),
      postUris
    }
    
    pagesStore.put(page)
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(actualPageId)
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  /**
   * Get feed pages for a specific feed type
   */
  async getFeedPages(
    feedType: string,
    options: {
      limit?: number
      offset?: number
    } = {}
  ): Promise<FeedPage[]> {
    const db = this.ensureDb()
    const transaction = db.transaction(['feed_pages'], 'readonly')
    const store = transaction.objectStore('feed_pages')
    const index = store.index('by_feed_type')
    
    const pages: FeedPage[] = []
    const { limit = 10, offset = 0 } = options
    let skipped = 0
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(feedType), 'prev')
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && pages.length < limit) {
          if (skipped < offset) {
            skipped++
            cursor.continue()
            return
          }
          
          pages.push(cursor.value)
          cursor.continue()
        } else {
          resolve(pages)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Get feed items by URIs (for reconstructing pages)
   */
  async getFeedItemsByUris(uris: string[]): Promise<FeedItem[]> {
    const db = this.ensureDb()
    const transaction = db.transaction(['feed_items'], 'readonly')
    const store = transaction.objectStore('feed_items')
    
    const items: FeedItem[] = []
    
    for (const uri of uris) {
      const request = store.get(uri)
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            const item = request.result
            // Remove internal fields
            delete item._feedType
            delete item._cachedAt
            items.push(item)
          }
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }
    
    return items
  }
  
  /**
   * Get posts by URIs
   */
  async getPostsByUris(uris: string[]): Promise<Post[]> {
    const db = this.ensureDb()
    const transaction = db.transaction(['posts'], 'readonly')
    const store = transaction.objectStore('posts')
    
    const posts: Post[] = []
    
    for (const uri of uris) {
      const request = store.get(uri)
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            const post = request.result
            delete post._cachedAt
            posts.push(post)
          }
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }
    
    return posts
  }
  
  /**
   * Get a single post by URI
   */
  async getPost(uri: string): Promise<Post | null> {
    const result = await this.getItem<Post & { _cachedAt?: number }>('posts', uri)
    if (result) {
      delete result._cachedAt
    }
    return result
  }
  
  /**
   * Save individual posts (useful for updates)
   */
  async savePosts(posts: Post[]): Promise<void> {
    const enrichedPosts = posts.map(post => ({
      ...post,
      _cachedAt: Date.now()
    }))
    return this.saveItems('posts', enrichedPosts)
  }
  
  /**
   * Get feed metadata
   */
  async getMetadata(feedType: string): Promise<StorageMetadata | null> {
    return this.getItem<StorageMetadata>('metadata', feedType)
  }
  
  /**
   * Save feed metadata
   */
  async saveMetadata(feedType: string, metadata: Omit<StorageMetadata, 'id'>): Promise<void> {
    return this.saveItem('metadata', {
      ...metadata,
      id: feedType
    })
  }
  
  /**
   * Get all posts (with pagination)
   */
  async getAllPosts(options: {
    limit?: number
    offset?: number
    sortBy?: 'indexedAt' | 'createdAt'
    direction?: 'asc' | 'desc'
  } = {}): Promise<Post[]> {
    const { sortBy = 'indexedAt', direction = 'desc' } = options
    const indexName = sortBy === 'createdAt' ? 'by_created_at' : 'by_indexed_at'
    const cursorDirection = direction === 'desc' ? 'prev' : 'next'
    
    const posts = await this.getAllItems<Post & { _cachedAt?: number }>('posts', {
      ...options,
      indexName,
      direction: cursorDirection
    })
    
    // Remove internal fields
    return posts.map(post => {
      delete post._cachedAt
      return post
    })
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalPosts: number
    totalFeedItems: number
    totalPages: number
    oldestPost: Date | null
    newestPost: Date | null
    cacheSize: number
  }> {
    const [totalPosts, totalFeedItems, totalPages] = await Promise.all([
      this.getCount('posts'),
      this.getCount('feed_items'),
      this.getCount('feed_pages')
    ])
    
    // Get oldest and newest posts
    const oldestPosts = await this.getAllItems<Post>('posts', {
      limit: 1,
      indexName: 'by_indexed_at',
      direction: 'next'
    })
    
    const newestPosts = await this.getAllItems<Post>('posts', {
      limit: 1,
      indexName: 'by_indexed_at',
      direction: 'prev'
    })
    
    return {
      totalPosts,
      totalFeedItems,
      totalPages,
      oldestPost: oldestPosts[0] ? new Date(oldestPosts[0].indexedAt) : null,
      newestPost: newestPosts[0] ? new Date(newestPosts[0].indexedAt) : null,
      cacheSize: totalPosts + totalFeedItems // Rough estimate
    }
  }
  
  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep: number = 7): Promise<{
    deletedPosts: number
    deletedFeedItems: number
    deletedPages: number
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const [deletedPosts, deletedFeedItems, deletedPages] = await Promise.all([
      this.deleteOlderThan('posts', 'indexedAt', cutoffDate),
      this.deleteOlderThan('feed_items', 'post.indexedAt', cutoffDate),
      this.deleteOlderThan('feed_pages', 'timestamp', cutoffDate)
    ])
    
    return {
      deletedPosts,
      deletedFeedItems,
      deletedPages
    }
  }
  
  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    return this.clearStores(['posts', 'feed_items', 'feed_pages', 'metadata'])
  }
}