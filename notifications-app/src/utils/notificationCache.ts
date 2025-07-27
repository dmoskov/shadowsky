import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { StorageManager } from './storageManager'

const CACHE_KEY_PREFIX = 'bsky_notifications_'
const CACHE_EXPIRY_KEY = 'bsky_notifications_expiry'
const CACHE_VERSION = 'v2' // Increment this to invalidate old caches
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

interface CachedData {
  version: string
  timestamp: number
  pages: Array<{
    notifications: Notification[]
    cursor?: string
  }>
  priority?: boolean
  compressed?: boolean
}

/**
 * Local storage cache for notifications
 * IMPORTANT: This class only accesses localStorage and NEVER makes API calls
 * Therefore, it is NOT subject to rate limiting
 * 
 * Rate limiting only applies to actual Bluesky API calls in the notification service
 */
export class NotificationCache {
  private static getCacheKey(priority?: boolean): string {
    return `${CACHE_KEY_PREFIX}${priority ? 'priority' : 'all'}_${CACHE_VERSION}`
  }

  /**
   * Save notifications to localStorage (NO rate limiting - local operation only)
   */
  static save(pages: Array<{ notifications: Notification[], cursor?: string }>, priority?: boolean): void {
    const timestamp = new Date().toLocaleTimeString()
    const notificationCount = pages.reduce((sum, p) => sum + p.notifications.length, 0)
    
    console.log(`🟡 [${timestamp}] CACHE SAVE ATTEMPT: ${notificationCount} notifications (priority: ${priority})`)
    
    // Check storage health before saving
    const storageHealth = StorageManager.getStorageHealth()
    if (storageHealth.status === 'critical') {
      console.log(`⚠️ [${timestamp}] Storage critical - cleaning up before save`)
      StorageManager.cleanupStorage(14) // Keep only 2 weeks when critical
    }
    
    try {
      const cacheKey = this.getCacheKey(priority)
      
      // Check if we need to compress data
      const metrics = StorageManager.getStorageMetrics()
      const shouldCompress = metrics.usagePercentage > 50 || notificationCount > 1000
      
      let dataToStore: CachedData
      
      if (shouldCompress) {
        console.log(`📦 [${timestamp}] Compressing notifications for efficient storage`)
        const compressedPages = StorageManager.pruneNotifications(pages)
        dataToStore = {
          version: CACHE_VERSION,
          timestamp: Date.now(),
          pages: compressedPages as any,
          priority,
          compressed: true
        }
      } else {
        dataToStore = {
          version: CACHE_VERSION,
          timestamp: Date.now(),
          pages,
          priority,
          compressed: false
        }
      }
      
      // Store in chunks if data is too large
      const dataStr = JSON.stringify(dataToStore)
      const chunkSize = 1024 * 1024 // 1MB chunks
      const chunks = Math.ceil(dataStr.length / chunkSize)
      
      console.log(`📦 [${timestamp}] Data size: ${(dataStr.length / 1024).toFixed(1)}KB, chunks: ${chunks}`)
      
      if (chunks > 1) {
        // Store data in chunks
        for (let i = 0; i < chunks; i++) {
          const chunk = dataStr.slice(i * chunkSize, (i + 1) * chunkSize)
          localStorage.setItem(`${cacheKey}_chunk_${i}`, chunk)
        }
        localStorage.setItem(`${cacheKey}_chunks`, chunks.toString())
        console.log(`📦 [${timestamp}] Stored in ${chunks} chunks to localStorage`)
      } else {
        // Store as single item
        localStorage.setItem(cacheKey, dataStr)
        console.log(`📦 [${timestamp}] Stored as single item to localStorage`)
      }
      
      // Store expiry time
      const expiryTime = Date.now() + CACHE_DURATION
      localStorage.setItem(`${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`, expiryTime.toString())
      
      const expiryDate = new Date(expiryTime)
      console.log(`✅ [${timestamp}] CACHE SAVED: ${notificationCount} notifications (priority: ${priority})`)
      console.log(`⏰ [${timestamp}] Cache expires: ${expiryDate.toLocaleString()}`)
      
      // Log storage metrics after save
      const postSaveMetrics = StorageManager.getStorageMetrics()
      console.log(`📊 [${timestamp}] Storage usage: ${postSaveMetrics.usagePercentage.toFixed(1)}% (${StorageManager.formatBytes(postSaveMetrics.totalSize)} / ~5MB)`)
      console.log(`📊 [${timestamp}] Notification data: ${StorageManager.formatBytes(postSaveMetrics.notificationDataSize)}`)
      
      // Verify the save worked
      const verification = localStorage.getItem(cacheKey) || localStorage.getItem(`${cacheKey}_chunk_0`)
      if (verification) {
        console.log(`✅ [${timestamp}] Cache save verified - data exists in localStorage`)
      } else {
        console.log(`❌ [${timestamp}] Cache save verification FAILED - no data found in localStorage`)
      }
      
    } catch (error) {
      console.error(`❌ [${timestamp}] Failed to cache notifications:`, error)
      // If storage is full, clear old caches
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.log(`🧹 [${timestamp}] Storage full, clearing old caches`)
        this.clearOldCaches()
        // Try again with cleared cache
        try {
          const cacheKey = this.getCacheKey(priority)
          const data: CachedData = {
            version: CACHE_VERSION,
            timestamp: Date.now(),
            pages,
            priority
          }
          localStorage.setItem(cacheKey, JSON.stringify(data))
          console.log(`✅ [${timestamp}] Cache saved after clearing old data`)
        } catch (retryError) {
          console.error(`❌ [${timestamp}] Failed to cache after clearing:`, retryError)
        }
      }
    }
  }

  /**
   * Load notifications from localStorage (NO rate limiting - local operation only)
   * Returns null if cache is expired, invalid, or doesn't exist
   */
  static load(priority?: boolean): CachedData | null {
    const timestamp = new Date().toLocaleTimeString()
    
    console.log(`🔍 [${timestamp}] CACHE LOAD ATTEMPT (priority: ${priority})`)
    
    try {
      const cacheKey = this.getCacheKey(priority)
      const expiryKey = `${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`
      
      // Check if cache has expired
      const expiryTime = localStorage.getItem(expiryKey)
      if (!expiryTime) {
        console.log(`❌ [${timestamp}] CACHE MISS: No expiry time found (priority: ${priority})`)
        return null
      }
      
      const expiryMs = parseInt(expiryTime)
      const now = Date.now()
      
      if (now > expiryMs) {
        const expiredDate = new Date(expiryMs)
        console.log(`⏰ [${timestamp}] CACHE EXPIRED: expired at ${expiredDate.toLocaleString()} (priority: ${priority})`)
        this.clear(priority)
        return null
      }
      
      const remainingTime = Math.floor((expiryMs - now) / (1000 * 60)) // minutes
      console.log(`⏰ [${timestamp}] Cache valid for ${remainingTime} more minutes`)
      
      // Check if data is chunked
      const chunksCount = localStorage.getItem(`${cacheKey}_chunks`)
      let dataStr: string
      
      if (chunksCount) {
        console.log(`📦 [${timestamp}] Loading chunked data (${chunksCount} chunks)`)
        // Reassemble chunks
        const chunks: string[] = []
        for (let i = 0; i < parseInt(chunksCount); i++) {
          const chunk = localStorage.getItem(`${cacheKey}_chunk_${i}`)
          if (!chunk) {
            console.log(`❌ [${timestamp}] CHUNK MISSING: chunk ${i} not found, clearing cache`)
            this.clear(priority)
            return null
          }
          chunks.push(chunk)
        }
        dataStr = chunks.join('')
        console.log(`📦 [${timestamp}] Successfully reassembled ${chunks.length} chunks`)
      } else {
        // Load as single item
        const data = localStorage.getItem(cacheKey)
        if (!data) {
          console.log(`❌ [${timestamp}] CACHE MISS: No data found in localStorage (priority: ${priority})`)
          return null
        }
        dataStr = data
        console.log(`📦 [${timestamp}] Loading single data item`)
      }
      
      console.log(`📦 [${timestamp}] Parsing ${(dataStr.length / 1024).toFixed(1)}KB of cached data`)
      
      let cachedData: CachedData
      try {
        cachedData = JSON.parse(dataStr)
      } catch (parseError) {
        console.error(`❌ [${timestamp}] Failed to parse cached data:`, parseError)
        console.log(`🔍 [${timestamp}] First 100 chars of invalid data:`, dataStr.substring(0, 100))
        this.clear(priority)
        return null
      }
      
      // Validate version
      if (cachedData.version !== CACHE_VERSION) {
        console.log(`❌ [${timestamp}] VERSION MISMATCH: expected ${CACHE_VERSION}, got ${cachedData.version}`)
        this.clear(priority)
        return null
      }
      
      const notificationCount = cachedData.pages.reduce((sum, p) => sum + p.notifications.length, 0)
      const cacheAge = Math.floor((now - cachedData.timestamp) / (1000 * 60)) // minutes
      
      console.log(`✅ [${timestamp}] CACHE HIT: ${notificationCount} notifications loaded (priority: ${priority})`)
      console.log(`📊 [${timestamp}] Cache age: ${cacheAge} minutes, ${cachedData.pages.length} pages`)
      
      // If data is compressed, decompress it
      if (cachedData.compressed) {
        console.log(`📦 [${timestamp}] Decompressing notification data`)
        cachedData.pages = cachedData.pages.map(page => ({
          ...page,
          notifications: page.notifications.map(n => 
            StorageManager.decompressNotification(n as any) as Notification
          )
        }))
      }
      
      return cachedData
    } catch (error) {
      console.error(`❌ [${timestamp}] Failed to load cached notifications:`, error)
      this.clear(priority)
      return null
    }
  }

  static clear(priority?: boolean): void {
    const timestamp = new Date().toLocaleTimeString()
    
    try {
      const cacheKey = this.getCacheKey(priority)
      const expiryKey = `${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`
      
      // Check what we're clearing
      const hadData = localStorage.getItem(cacheKey) || localStorage.getItem(`${cacheKey}_chunk_0`)
      const hadExpiry = localStorage.getItem(expiryKey)
      
      // Remove main cache
      localStorage.removeItem(cacheKey)
      localStorage.removeItem(expiryKey)
      
      // Remove chunks if they exist
      const chunksCount = localStorage.getItem(`${cacheKey}_chunks`)
      let chunksCleared = 0
      if (chunksCount) {
        for (let i = 0; i < parseInt(chunksCount); i++) {
          localStorage.removeItem(`${cacheKey}_chunk_${i}`)
          chunksCleared++
        }
        localStorage.removeItem(`${cacheKey}_chunks`)
      }
      
      if (hadData || hadExpiry || chunksCleared > 0) {
        console.log(`🗑️ [${timestamp}] CACHE CLEARED (priority: ${priority})`)
        if (chunksCleared > 0) {
          console.log(`🗑️ [${timestamp}] Cleared ${chunksCleared} chunks`)
        }
      } else {
        console.log(`🗑️ [${timestamp}] Cache was already empty (priority: ${priority})`)
      }
    } catch (error) {
      console.error(`❌ [${timestamp}] Failed to clear cache:`, error)
    }
  }

  static clearAll(): void {
    this.clear(true)
    this.clear(false)
  }

  private static clearOldCaches(): void {
    // Clear all notification-related items from localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log(`Cleared ${keysToRemove.length} old cache entries`)
  }

  static getCacheInfo(): { 
    hasPriorityCache: boolean
    hasAllCache: boolean
    priorityCacheSize: number
    allCacheSize: number
    priorityExpiry: Date | null
    allExpiry: Date | null
  } {
    const priorityData = this.load(true)
    const allData = this.load(false)
    
    const priorityExpiryStr = localStorage.getItem(`${CACHE_EXPIRY_KEY}_priority`)
    const allExpiryStr = localStorage.getItem(`${CACHE_EXPIRY_KEY}_all`)
    
    return {
      hasPriorityCache: !!priorityData,
      hasAllCache: !!allData,
      priorityCacheSize: priorityData ? priorityData.pages.reduce((sum, p) => sum + p.notifications.length, 0) : 0,
      allCacheSize: allData ? allData.pages.reduce((sum, p) => sum + p.notifications.length, 0) : 0,
      priorityExpiry: priorityExpiryStr ? new Date(parseInt(priorityExpiryStr)) : null,
      allExpiry: allExpiryStr ? new Date(parseInt(allExpiryStr)) : null
    }
  }
}