/**
 * Storage Manager for optimizing localStorage usage
 * Handles compression, size monitoring, and intelligent data management
 */

import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

// localStorage limits vary by browser but are typically 5-10MB
// We'll target 1MB for notification data to leave room for other app data
const TARGET_STORAGE_SIZE = 1 * 1024 * 1024 // 1MB
const STORAGE_WARNING_THRESHOLD = 0.8 // Warn at 80% usage
const STORAGE_CRITICAL_THRESHOLD = 0.95 // Critical at 95% usage

interface StorageMetrics {
  totalSize: number
  notificationDataSize: number
  otherDataSize: number
  availableSpace: number
  usagePercentage: number
  itemCount: number
  largestItems: Array<{ key: string; size: number }>
}

interface CompressedNotification {
  // Keep only essential fields to maximize storage
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  reason: string
  reasonSubject?: string
  record?: {
    text?: string
    $type: string
  }
  isRead: boolean
  indexedAt: string
  labels?: string[]
}

export class StorageManager {
  /**
   * Calculate the size of a string in bytes
   */
  private static getByteSize(str: string): number {
    return new Blob([str]).size
  }

  /**
   * Get comprehensive storage metrics
   */
  static getStorageMetrics(): StorageMetrics {
    let totalSize = 0
    let notificationDataSize = 0
    let itemCount = 0
    const items: Array<{ key: string; size: number }> = []

    // Analyze all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      const value = localStorage.getItem(key) || ''
      const size = this.getByteSize(key) + this.getByteSize(value)
      
      totalSize += size
      itemCount++
      
      items.push({ key, size })
      
      // Track notification-specific data
      if (key.includes('notification') || key.includes('bsky_')) {
        notificationDataSize += size
      }
    }

    // Sort items by size
    items.sort((a, b) => b.size - a.size)
    
    // Estimate available space (conservative estimate)
    const estimatedMaxSize = 5 * 1024 * 1024 // 5MB typical limit
    const availableSpace = Math.max(0, estimatedMaxSize - totalSize)
    
    return {
      totalSize,
      notificationDataSize,
      otherDataSize: totalSize - notificationDataSize,
      availableSpace,
      usagePercentage: (totalSize / estimatedMaxSize) * 100,
      itemCount,
      largestItems: items.slice(0, 10)
    }
  }

  /**
   * Compress notification data by removing non-essential fields
   */
  static compressNotification(notification: Notification): CompressedNotification {
    return {
      uri: notification.uri,
      cid: notification.cid,
      author: {
        did: notification.author.did,
        handle: notification.author.handle,
        displayName: notification.author.displayName,
        avatar: notification.author.avatar
      },
      reason: notification.reason,
      reasonSubject: notification.reasonSubject,
      record: notification.record ? {
        text: (notification.record as any).text,
        $type: notification.record.$type as string
      } : undefined,
      isRead: notification.isRead,
      indexedAt: notification.indexedAt,
      labels: notification.labels?.map(label => 
        typeof label === 'string' ? label : label.val
      )
    }
  }

  /**
   * Decompress notification data back to full format
   */
  static decompressNotification(compressed: CompressedNotification): Partial<Notification> {
    return {
      ...compressed,
      author: {
        ...compressed.author,
        did: compressed.author.did,
        handle: compressed.author.handle,
        displayName: compressed.author.displayName,
        avatar: compressed.author.avatar,
        viewer: { 
          muted: false,
          blockedBy: false
        },
        labels: [],
        createdAt: ''
      } as any
    }
  }

  /**
   * Optimize stored notifications to fit within size limits
   */
  static optimizeNotificationStorage(
    notifications: Notification[], 
    targetSize: number = TARGET_STORAGE_SIZE
  ): CompressedNotification[] {
    const compressed: CompressedNotification[] = []
    let currentSize = 0

    // Sort by date (newest first) to prioritize recent notifications
    const sorted = [...notifications].sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )

    for (const notif of sorted) {
      const compressedNotif = this.compressNotification(notif)
      const notifSize = this.getByteSize(JSON.stringify(compressedNotif))
      
      if (currentSize + notifSize <= targetSize) {
        compressed.push(compressedNotif)
        currentSize += notifSize
      } else {
        // Stop when we reach the size limit
        console.log(`📊 Storage optimization: Kept ${compressed.length} of ${notifications.length} notifications`)
        break
      }
    }

    return compressed
  }

  /**
   * Clean up old or unnecessary data from localStorage
   */
  static cleanupStorage(keepDays: number = 30): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - keepDays)
    
    const keysToRemove: string[] = []
    let removedSize = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      // Skip non-notification data
      if (!key.includes('notification') && !key.includes('bsky_')) continue

      try {
        const value = localStorage.getItem(key)
        if (!value) continue

        // Try to parse and check dates
        const data = JSON.parse(value)
        if (data.timestamp && new Date(data.timestamp) < cutoffDate) {
          keysToRemove.push(key)
          removedSize += this.getByteSize(key) + this.getByteSize(value)
        }
      } catch (e) {
        // If we can't parse it, consider removing old-looking keys
        if (key.includes('_old') || key.includes('_temp')) {
          keysToRemove.push(key)
        }
      }
    }

    // Remove identified keys
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} old items, freed ${(removedSize / 1024).toFixed(1)}KB`)
    }
  }

  /**
   * Get a storage health report
   */
  static getStorageHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    message: string
    recommendations: string[]
  } {
    const metrics = this.getStorageMetrics()
    const usage = metrics.usagePercentage / 100

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = ''
    const recommendations: string[] = []

    if (usage >= STORAGE_CRITICAL_THRESHOLD) {
      status = 'critical'
      message = `Critical: Storage is ${(usage * 100).toFixed(1)}% full`
      recommendations.push('Clear old notification data immediately')
      recommendations.push('Reduce the number of days of history kept')
    } else if (usage >= STORAGE_WARNING_THRESHOLD) {
      status = 'warning'
      message = `Warning: Storage is ${(usage * 100).toFixed(1)}% full`
      recommendations.push('Consider clearing older notifications')
      recommendations.push('Monitor storage usage closely')
    } else {
      status = 'healthy'
      message = `Storage usage is healthy at ${(usage * 100).toFixed(1)}%`
    }

    // Add specific recommendations based on data
    if (metrics.notificationDataSize > TARGET_STORAGE_SIZE) {
      recommendations.push(`Notification data (${(metrics.notificationDataSize / 1024 / 1024).toFixed(2)}MB) exceeds target size`)
    }

    if (metrics.largestItems[0]?.size > 500 * 1024) { // Items larger than 500KB
      recommendations.push('Some stored items are very large and could be optimized')
    }

    return { status, message, recommendations }
  }

  /**
   * Intelligently prune notification data to stay within limits
   */
  static pruneNotifications(
    pages: Array<{ notifications: Notification[], cursor?: string }>,
    maxSize: number = TARGET_STORAGE_SIZE
  ): Array<{ notifications: CompressedNotification[], cursor?: string }> {
    // Flatten all notifications
    const allNotifications = pages.flatMap(p => p.notifications)
    
    // Optimize storage
    const optimized = this.optimizeNotificationStorage(allNotifications, maxSize)
    
    // Reconstruct pages structure
    const optimizedPages: Array<{ notifications: CompressedNotification[], cursor?: string }> = []
    let currentPage: CompressedNotification[] = []
    let notifIndex = 0
    
    for (const page of pages) {
      const pageSize = page.notifications.length
      const pageNotifs = optimized.slice(notifIndex, notifIndex + pageSize)
      
      if (pageNotifs.length > 0) {
        optimizedPages.push({
          notifications: pageNotifs,
          cursor: page.cursor
        })
      }
      
      notifIndex += pageSize
      
      // Stop if we've used all optimized notifications
      if (notifIndex >= optimized.length) break
    }
    
    return optimizedPages
  }

  /**
   * Format bytes for human reading
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`
  }
}