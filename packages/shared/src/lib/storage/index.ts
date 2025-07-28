/**
 * Storage module exports
 * Provides unified IndexedDB storage for the entire application
 */

export * from './indexed-db-core'
export * from './feed-storage'
export * from './notification-storage'
export * from './query-persistence'
export * from './migration'

// Re-export singleton instances for convenience
import { FeedStorageService } from './feed-storage'
import { NotificationStorageService } from './notification-storage'

export const feedStorage = FeedStorageService.getInstance()
export const notificationStorage = NotificationStorageService.getInstance()