/**
 * Notification storage service using IndexedDB
 * Provides persistent storage for notifications
 */

import { IndexedDBStore, StorageConfig, Notification, StorageMetadata } from './indexed-db-core'

const NOTIFICATION_DB_CONFIG: StorageConfig = {
  dbName: 'BskyNotificationStorage',
  version: 1,
  stores: [
    {
      name: 'notifications',
      keyPath: 'uri',
      indexes: [
        { name: 'by_indexed_at', keyPath: 'indexedAt' },
        { name: 'by_reason', keyPath: 'reason' },
        { name: 'by_author', keyPath: 'author.did' },
        { name: 'by_is_read', keyPath: 'isRead' }
      ]
    },
    {
      name: 'metadata',
      keyPath: 'id'
    }
  ]
}

export class NotificationStorageService extends IndexedDBStore {
  private static instance: NotificationStorageService
  
  private constructor() {
    super(NOTIFICATION_DB_CONFIG)
  }
  
  static getInstance(): NotificationStorageService {
    if (!NotificationStorageService.instance) {
      NotificationStorageService.instance = new NotificationStorageService()
    }
    return NotificationStorageService.instance
  }
  
  /**
   * Save a single notification
   */
  async saveNotification(notification: Notification): Promise<void> {
    return this.saveItem('notifications', notification)
  }
  
  /**
   * Save multiple notifications
   */
  async saveNotifications(notifications: Notification[]): Promise<void> {
    return this.saveItems('notifications', notifications)
  }
  
  /**
   * Get a notification by URI
   */
  async getNotification(uri: string): Promise<Notification | null> {
    return this.getItem('notifications', uri)
  }
  
  /**
   * Get all notifications with pagination
   */
  async getAllNotifications(
    limit = 100,
    offset = 0
  ): Promise<Notification[]> {
    return this.getAllItems('notifications', {
      limit,
      offset,
      indexName: 'by_indexed_at',
      direction: 'prev' // Newest first
    })
  }
  
  /**
   * Get notifications by reason
   */
  async getNotificationsByReason(
    reason: string,
    limit = 100
  ): Promise<Notification[]> {
    const db = this.ensureDb()
    const transaction = db.transaction(['notifications'], 'readonly')
    const store = transaction.objectStore('notifications')
    const index = store.index('by_reason')
    
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
  
  /**
   * Get unread notifications
   */
  async getUnreadNotifications(limit = 100): Promise<Notification[]> {
    const db = this.ensureDb()
    const transaction = db.transaction(['notifications'], 'readonly')
    const store = transaction.objectStore('notifications')
    const index = store.index('by_is_read')
    
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
  
  /**
   * Mark notification as read
   */
  async markAsRead(uri: string): Promise<void> {
    const notification = await this.getNotification(uri)
    if (notification) {
      notification.isRead = true
      await this.saveNotification(notification)
    }
  }
  
  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(uris: string[]): Promise<void> {
    const db = this.ensureDb()
    const transaction = db.transaction(['notifications'], 'readwrite')
    const store = transaction.objectStore('notifications')
    
    for (const uri of uris) {
      const request = store.get(uri)
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const notification = request.result
          if (notification) {
            notification.isRead = true
            store.put(notification)
          }
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  /**
   * Get metadata
   */
  async getMetadata(): Promise<StorageMetadata | null> {
    return this.getItem('metadata', 'main')
  }
  
  /**
   * Save metadata
   */
  async saveMetadata(metadata: Omit<StorageMetadata, 'id'>): Promise<void> {
    return this.saveItem('metadata', {
      ...metadata,
      id: 'main'
    })
  }
  
  /**
   * Get notification statistics
   */
  async getStats(): Promise<{
    totalNotifications: number
    unreadCount: number
    reasonCounts: Record<string, number>
    oldestNotification: Date | null
    newestNotification: Date | null
  }> {
    const db = this.ensureDb()
    const transaction = db.transaction(['notifications'], 'readonly')
    const store = transaction.objectStore('notifications')
    
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
          stats.reasonCounts[notification.reason] = 
            (stats.reasonCounts[notification.reason] || 0) + 1
          
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
  
  /**
   * Clean up old notifications
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    return this.deleteOlderThan('notifications', 'indexedAt', cutoffDate)
  }
  
  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    return this.clearStores(['notifications', 'metadata'])
  }
}

// Export singleton instance
export const notificationStorage = NotificationStorageService.getInstance()