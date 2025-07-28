/**
 * Core IndexedDB storage service for unified data persistence
 * Provides a consistent storage layer for both main app and notifications app
 */

import { AppBskyFeedDefs, AppBskyNotificationListNotifications } from '@atproto/api'

export type Post = AppBskyFeedDefs.PostView
export type FeedItem = AppBskyFeedDefs.FeedViewPost
export type Notification = AppBskyNotificationListNotifications.Notification

export interface StorageMetadata {
  id: string
  lastUpdate: number
  totalCount: number
  version: string
}

export interface FeedPageMetadata {
  cursor?: string
  timestamp: number
  postCount: number
}

export interface StorageConfig {
  dbName: string
  version: number
  stores: StoreConfig[]
}

export interface StoreConfig {
  name: string
  keyPath: string
  indexes?: IndexConfig[]
}

export interface IndexConfig {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

/**
 * Base class for IndexedDB storage operations
 * Provides common functionality for all storage services
 */
export abstract class IndexedDBStore {
  protected db: IDBDatabase | null = null
  protected config: StorageConfig
  
  constructor(config: StorageConfig) {
    this.config = config
  }
  
  /**
   * Initialize the database and create stores/indexes
   */
  async init(): Promise<void> {
    if (this.db) return
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version)
      
      request.onerror = () => {
        console.error(`Failed to open ${this.config.dbName}:`, request.error)
        reject(request.error)
      }
      
      request.onsuccess = () => {
        this.db = request.result
        console.log(`${this.config.dbName} initialized successfully`)
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create stores and indexes based on config
        for (const storeConfig of this.config.stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, { 
              keyPath: storeConfig.keyPath 
            })
            
            // Create indexes
            if (storeConfig.indexes) {
              for (const indexConfig of storeConfig.indexes) {
                store.createIndex(
                  indexConfig.name, 
                  indexConfig.keyPath, 
                  indexConfig.options
                )
              }
            }
          }
        }
      }
    })
  }
  
  /**
   * Ensure database is initialized
   */
  protected ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error(`${this.config.dbName} not initialized. Call init() first.`)
    }
    return this.db
  }
  
  /**
   * Generic method to save an item to a store
   */
  protected async saveItem<T>(storeName: string, item: T): Promise<void> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.put(item)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Generic method to save multiple items to a store
   */
  protected async saveItems<T>(storeName: string, items: T[]): Promise<void> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)
    
    for (const item of items) {
      store.put(item)
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  /**
   * Generic method to get an item by key
   */
  protected async getItem<T>(storeName: string, key: string): Promise<T | null> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Generic method to get all items from a store with pagination
   */
  protected async getAllItems<T>(
    storeName: string, 
    options: {
      limit?: number
      offset?: number
      indexName?: string
      direction?: IDBCursorDirection
    } = {}
  ): Promise<T[]> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)
    
    const { 
      limit = 1000, 
      offset = 0, 
      indexName,
      direction = 'next' 
    } = options
    
    const items: T[] = []
    let count = 0
    let skipped = 0
    
    return new Promise((resolve, reject) => {
      const source = indexName ? store.index(indexName) : store
      const request = source.openCursor(null, direction)
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && count < limit) {
          if (skipped < offset) {
            skipped++
            cursor.continue()
            return
          }
          
          items.push(cursor.value)
          count++
          cursor.continue()
        } else {
          resolve(items)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Get count of items in a store
   */
  protected async getCount(storeName: string): Promise<number> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)
    
    return new Promise((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Clear all data from specified stores
   */
  async clearStores(storeNames: string[]): Promise<void> {
    const db = this.ensureDb()
    const transaction = db.transaction(storeNames, 'readwrite')
    
    for (const storeName of storeNames) {
      transaction.objectStore(storeName).clear()
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  /**
   * Delete items older than a specific date
   */
  protected async deleteOlderThan(
    storeName: string, 
    dateField: string,
    cutoffDate: Date
  ): Promise<number> {
    const db = this.ensureDb()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)
    
    let deletedCount = 0
    const cutoffTime = cutoffDate.getTime()
    
    return new Promise((resolve, reject) => {
      const request = store.openCursor()
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor) {
          const item = cursor.value
          const itemDate = new Date(item[dateField]).getTime()
          
          if (itemDate < cutoffTime) {
            cursor.delete()
            deletedCount++
          }
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}