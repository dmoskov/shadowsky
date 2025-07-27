import { AppBskyNotificationListNotifications } from '@atproto/api'

type Notification = AppBskyNotificationListNotifications.Notification

interface NotificationMeta {
  id: string
  lastFetch: number
  pages: number[]
  totalCount: number
}

export class NotificationStorageDB {
  private static instance: NotificationStorageDB
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'bsky_notifications_db'
  private readonly DB_VERSION = 1
  
  // Store names
  private readonly NOTIFICATIONS_STORE = 'notifications'
  private readonly META_STORE = 'metadata'
  
  // Index names
  private readonly INDEXED_AT_INDEX = 'by_indexed_at'
  private readonly REASON_INDEX = 'by_reason'
  private readonly AUTHOR_INDEX = 'by_author'
  private readonly IS_READ_INDEX = 'by_is_read'
  
  private constructor() {}
  
  static getInstance(): NotificationStorageDB {
    if (!NotificationStorageDB.instance) {
      NotificationStorageDB.instance = new NotificationStorageDB()
    }
    return NotificationStorageDB.instance
  }
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }
      
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create notifications store
        if (!db.objectStoreNames.contains(this.NOTIFICATIONS_STORE)) {
          const notificationsStore = db.createObjectStore(this.NOTIFICATIONS_STORE, {
            keyPath: 'uri'
          })
          
          // Create indexes for efficient querying
          notificationsStore.createIndex(this.INDEXED_AT_INDEX, 'indexedAt', { unique: false })
          notificationsStore.createIndex(this.REASON_INDEX, 'reason', { unique: false })
          notificationsStore.createIndex(this.AUTHOR_INDEX, 'author.did', { unique: false })
          notificationsStore.createIndex(this.IS_READ_INDEX, 'isRead', { unique: false })
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: 'id' })
        }
      }
    })
  }
  
  private ensureDB(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
  }
  
  // Save individual notification
  async saveNotification(notification: Notification): Promise<void> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    
    return new Promise((resolve, reject) => {
      const request = store.put(notification)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  
  // Batch save notifications
  async saveNotifications(notifications: Notification[]): Promise<void> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    
    return new Promise((resolve, reject) => {
      let completed = 0
      
      notifications.forEach(notification => {
        const request = store.put(notification)
        
        request.onsuccess = () => {
          completed++
          if (completed === notifications.length) {
            resolve()
          }
        }
        
        request.onerror = () => reject(request.error)
      })
      
      if (notifications.length === 0) {
        resolve()
      }
    })
  }
  
  // Get notification by URI
  async getNotification(uri: string): Promise<Notification | null> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readonly')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    
    return new Promise((resolve, reject) => {
      const request = store.get(uri)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
  
  // Get all notifications (with pagination)
  async getAllNotifications(limit = 100, offset = 0): Promise<Notification[]> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readonly')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    const index = store.index(this.INDEXED_AT_INDEX)
    
    return new Promise((resolve, reject) => {
      const notifications: Notification[] = []
      let skipped = 0
      
      // Open cursor in descending order (newest first)
      const request = index.openCursor(null, 'prev')
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && notifications.length < limit) {
          if (skipped < offset) {
            skipped++
            cursor.continue()
          } else {
            notifications.push(cursor.value)
            cursor.continue()
          }
        } else {
          resolve(notifications)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  // Get notifications by reason
  async getNotificationsByReason(reason: string, limit = 100): Promise<Notification[]> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readonly')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    const index = store.index(this.REASON_INDEX)
    
    return new Promise((resolve, reject) => {
      const notifications: Notification[] = []
      const request = index.openCursor(IDBKeyRange.only(reason))
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && notifications.length < limit) {
          notifications.push(cursor.value)
          cursor.continue()
        } else {
          resolve(notifications)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  // Get unread notifications
  async getUnreadNotifications(limit = 100): Promise<Notification[]> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readonly')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    const index = store.index(this.IS_READ_INDEX)
    
    return new Promise((resolve, reject) => {
      const notifications: Notification[] = []
      const request = index.openCursor(IDBKeyRange.only(false))
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor && notifications.length < limit) {
          notifications.push(cursor.value)
          cursor.continue()
        } else {
          resolve(notifications)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  // Mark notification as read
  async markAsRead(uri: string): Promise<void> {
    const notification = await this.getNotification(uri)
    if (notification) {
      notification.isRead = true
      await this.saveNotification(notification)
    }
  }
  
  // Save metadata
  async saveMetadata(meta: NotificationMeta): Promise<void> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.META_STORE], 'readwrite')
    const store = transaction.objectStore(this.META_STORE)
    
    return new Promise((resolve, reject) => {
      const request = store.put(meta)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  
  // Get metadata
  async getMetadata(): Promise<NotificationMeta | null> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.META_STORE], 'readonly')
    const store = transaction.objectStore(this.META_STORE)
    
    return new Promise((resolve, reject) => {
      const request = store.get('main')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
  
  // Clear all data
  async clearAll(): Promise<void> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE, this.META_STORE], 'readwrite')
    
    return new Promise((resolve, reject) => {
      let completed = 0
      const stores = [this.NOTIFICATIONS_STORE, this.META_STORE]
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        const request = store.clear()
        
        request.onsuccess = () => {
          completed++
          if (completed === stores.length) {
            resolve()
          }
        }
        
        request.onerror = () => reject(request.error)
      })
    })
  }
  
  // Get storage stats
  async getStats(): Promise<{
    totalNotifications: number
    unreadCount: number
    reasonCounts: Record<string, number>
    oldestNotification: Date | null
    newestNotification: Date | null
  }> {
    this.ensureDB()
    
    const transaction = this.db!.transaction([this.NOTIFICATIONS_STORE], 'readonly')
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE)
    
    return new Promise((resolve, reject) => {
      const stats = {
        totalNotifications: 0,
        unreadCount: 0,
        reasonCounts: {} as Record<string, number>,
        oldestNotification: null as Date | null,
        newestNotification: null as Date | null
      }
      
      const countRequest = store.count()
      countRequest.onsuccess = () => {
        stats.totalNotifications = countRequest.result
      }
      
      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor) {
          const notification = cursor.value
          
          // Count unread
          if (!notification.isRead) {
            stats.unreadCount++
          }
          
          // Count by reason
          stats.reasonCounts[notification.reason] = (stats.reasonCounts[notification.reason] || 0) + 1
          
          // Track dates
          const date = new Date(notification.indexedAt)
          if (!stats.oldestNotification || date < stats.oldestNotification) {
            stats.oldestNotification = date
          }
          if (!stats.newestNotification || date > stats.newestNotification) {
            stats.newestNotification = date
          }
          
          cursor.continue()
        } else {
          resolve(stats)
        }
      }
      
      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }
  
  // Migrate from localStorage
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const oldData = localStorage.getItem('bsky_extended_fetch_data_v1')
      if (!oldData) {
        return false
      }
      
      const parsed = JSON.parse(oldData)
      if (parsed.notifications && Array.isArray(parsed.notifications)) {
        await this.saveNotifications(parsed.notifications)
        
        // Save metadata
        await this.saveMetadata({
          id: 'main',
          lastFetch: parsed.lastFetch || Date.now(),
          pages: parsed.pages || [],
          totalCount: parsed.notifications.length
        })
        
        // Remove old data
        localStorage.removeItem('bsky_extended_fetch_data_v1')
        
        console.log(`Migrated ${parsed.notifications.length} notifications to IndexedDB`)
        return true
      }
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error)
    }
    
    return false
  }
}