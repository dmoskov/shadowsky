import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

const CACHE_KEY_PREFIX = 'bsky_notifications_'
const CACHE_EXPIRY_KEY = 'bsky_notifications_expiry'
const CACHE_VERSION = 'v1' // Increment this to invalidate old caches
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

interface CachedData {
  version: string
  timestamp: number
  pages: Array<{
    notifications: Notification[]
    cursor?: string
  }>
  priority?: boolean
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
    try {
      const cacheKey = this.getCacheKey(priority)
      const data: CachedData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        pages,
        priority
      }
      
      // Store in chunks if data is too large
      const dataStr = JSON.stringify(data)
      const chunkSize = 1024 * 1024 // 1MB chunks
      const chunks = Math.ceil(dataStr.length / chunkSize)
      
      if (chunks > 1) {
        // Store data in chunks
        for (let i = 0; i < chunks; i++) {
          const chunk = dataStr.slice(i * chunkSize, (i + 1) * chunkSize)
          localStorage.setItem(`${cacheKey}_chunk_${i}`, chunk)
        }
        localStorage.setItem(`${cacheKey}_chunks`, chunks.toString())
      } else {
        // Store as single item
        localStorage.setItem(cacheKey, dataStr)
      }
      
      // Store expiry time
      localStorage.setItem(`${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`, 
        (Date.now() + CACHE_DURATION).toString())
      
      console.log(`Cached ${pages.reduce((sum, p) => sum + p.notifications.length, 0)} notifications (priority: ${priority})`)
    } catch (error) {
      console.error('Failed to cache notifications:', error)
      // If storage is full, clear old caches
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
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
        } catch (retryError) {
          console.error('Failed to cache after clearing:', retryError)
        }
      }
    }
  }

  /**
   * Load notifications from localStorage (NO rate limiting - local operation only)
   * Returns null if cache is expired, invalid, or doesn't exist
   */
  static load(priority?: boolean): CachedData | null {
    try {
      const cacheKey = this.getCacheKey(priority)
      const expiryKey = `${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`
      
      // Check if cache has expired
      const expiryTime = localStorage.getItem(expiryKey)
      if (!expiryTime || Date.now() > parseInt(expiryTime)) {
        console.log('Cache expired or not found')
        this.clear(priority)
        return null
      }
      
      // Check if data is chunked
      const chunksCount = localStorage.getItem(`${cacheKey}_chunks`)
      let dataStr: string
      
      if (chunksCount) {
        // Reassemble chunks
        const chunks: string[] = []
        for (let i = 0; i < parseInt(chunksCount); i++) {
          const chunk = localStorage.getItem(`${cacheKey}_chunk_${i}`)
          if (!chunk) {
            console.log('Missing chunk, clearing cache')
            this.clear(priority)
            return null
          }
          chunks.push(chunk)
        }
        dataStr = chunks.join('')
      } else {
        // Load as single item
        const data = localStorage.getItem(cacheKey)
        if (!data) return null
        dataStr = data
      }
      
      const cachedData: CachedData = JSON.parse(dataStr)
      
      // Validate version
      if (cachedData.version !== CACHE_VERSION) {
        console.log('Cache version mismatch, clearing')
        this.clear(priority)
        return null
      }
      
      console.log(`Loaded ${cachedData.pages.reduce((sum, p) => sum + p.notifications.length, 0)} cached notifications (priority: ${priority})`)
      return cachedData
    } catch (error) {
      console.error('Failed to load cached notifications:', error)
      this.clear(priority)
      return null
    }
  }

  static clear(priority?: boolean): void {
    try {
      const cacheKey = this.getCacheKey(priority)
      const expiryKey = `${CACHE_EXPIRY_KEY}_${priority ? 'priority' : 'all'}`
      
      // Remove main cache
      localStorage.removeItem(cacheKey)
      localStorage.removeItem(expiryKey)
      
      // Remove chunks if they exist
      const chunksCount = localStorage.getItem(`${cacheKey}_chunks`)
      if (chunksCount) {
        for (let i = 0; i < parseInt(chunksCount); i++) {
          localStorage.removeItem(`${cacheKey}_chunk_${i}`)
        }
        localStorage.removeItem(`${cacheKey}_chunks`)
      }
      
      console.log(`Cleared notification cache (priority: ${priority})`)
    } catch (error) {
      console.error('Failed to clear cache:', error)
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