import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCacheService } from '../services/post-cache-service'

type Post = AppBskyFeedDefs.PostView

const POST_CACHE_KEY = 'bsky_notification_posts_'
const POST_CACHE_VERSION = 'v1'
const POST_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days - posts don't change often

interface CachedPostData {
  version: string
  timestamp: number
  posts: Record<string, Post> // URI -> Post mapping
}

/**
 * PostCache - Backward compatible wrapper around PostCacheService
 * This class now delegates to IndexedDB but maintains the same synchronous API
 * for backward compatibility. New code should use PostCacheService directly.
 */
export class PostCache {
  private static cacheService = PostCacheService.getInstance()
  private static initPromise: Promise<void> | null = null
  
  private static getCacheKey(): string {
    return `${POST_CACHE_KEY}${POST_CACHE_VERSION}`
  }
  
  private static ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.cacheService.init().catch(error => {
        console.error('Failed to initialize PostCacheService:', error)
      })
    }
    return this.initPromise
  }

  static save(posts: Post[]): void {
    // Fire and forget - save to IndexedDB asynchronously
    this.ensureInit().then(() => {
      return this.cacheService.cachePosts(posts)
    }).then(() => {
      console.log(`📮 Cached ${posts.length} posts to IndexedDB`)
    }).catch(error => {
      console.error('Failed to cache posts to IndexedDB:', error)
      // Fall back to localStorage on error
      this.saveToLocalStorage(posts)
    })
  }
  
  private static saveToLocalStorage(posts: Post[]): void {
    try {
      const cacheKey = this.getCacheKey()
      
      // Load existing cache to merge with new posts
      const existingData = this.loadFromLocalStorage()
      const postMap = existingData?.posts || {}
      
      // Add new posts to the map
      posts.forEach(post => {
        postMap[post.uri] = post
      })
      
      const data: CachedPostData = {
        version: POST_CACHE_VERSION,
        timestamp: Date.now(),
        posts: postMap
      }
      
      // Store the cache
      localStorage.setItem(cacheKey, JSON.stringify(data))
      
      console.log(`📮 Cached ${posts.length} new posts to localStorage (fallback)`)
    } catch (error) {
      console.error('Failed to cache posts to localStorage:', error)
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Clear old post cache if storage is full
        this.clear()
      }
    }
  }

  static load(): CachedPostData | null {
    // This method is synchronous for backward compatibility
    // It returns localStorage data if available, otherwise null
    // The migration to IndexedDB happens asynchronously in the background
    return this.loadFromLocalStorage()
  }
  
  private static loadFromLocalStorage(): CachedPostData | null {
    try {
      const cacheKey = this.getCacheKey()
      const data = localStorage.getItem(cacheKey)
      if (!data) return null
      
      const cachedData: CachedPostData = JSON.parse(data)
      
      // Validate version
      if (cachedData.version !== POST_CACHE_VERSION) {
        console.log('Post cache version mismatch, clearing')
        this.clear()
        return null
      }
      
      // Check if cache is expired
      if (Date.now() - cachedData.timestamp > POST_CACHE_DURATION) {
        console.log('Post cache expired, clearing')
        this.clear()
        return null
      }
      
      return cachedData
    } catch (error) {
      console.error('Failed to load cached posts:', error)
      this.clear()
      return null
    }
  }

  static getCachedPosts(uris: string[]): { cached: Post[], missing: string[] } {
    const cachedData = this.load()
    if (!cachedData) {
      return { cached: [], missing: uris }
    }
    
    const cached: Post[] = []
    const missing: string[] = []
    
    uris.forEach(uri => {
      const post = cachedData.posts[uri]
      if (post) {
        cached.push(post)
      } else {
        missing.push(uri)
      }
    })
    
    if (cached.length > 0) {
      console.log(`📮 Found ${cached.length} cached posts out of ${uris.length} requested`)
    }
    
    return { cached, missing }
  }

  static clear(): void {
    try {
      const cacheKey = this.getCacheKey()
      localStorage.removeItem(cacheKey)
      
      // Also clear IndexedDB asynchronously
      this.ensureInit().then(() => {
        return this.cacheService.clearCache()
      }).catch(error => {
        console.error('Failed to clear IndexedDB post cache:', error)
      })
      
      console.log('🗑️ Cleared post cache')
    } catch (error) {
      console.error('Failed to clear post cache:', error)
    }
  }

  static getCacheInfo(): { 
    hasCache: boolean
    postCount: number
    cacheAge: string | null
  } {
    const data = this.load()
    
    if (!data) {
      return {
        hasCache: false,
        postCount: 0,
        cacheAge: null
      }
    }
    
    const ageMs = Date.now() - data.timestamp
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    const hours = Math.floor((ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    
    let ageStr = ''
    if (days > 0) {
      ageStr = `${days}d ${hours}h`
    } else {
      ageStr = `${hours}h`
    }
    
    return {
      hasCache: true,
      postCount: Object.keys(data.posts).length,
      cacheAge: ageStr
    }
  }
  
  /**
   * Get IndexedDB cache info asynchronously
   * This is a new method for components that can handle async operations
   */
  static async getIndexedDBCacheInfo(): Promise<{
    hasCache: boolean
    postCount: number
    oldestPost: Date | null
    newestPost: Date | null
    lastUpdate: Date | null
  }> {
    try {
      await this.ensureInit()
      const stats = await this.cacheService.getCacheStats()
      
      return {
        hasCache: stats.totalPosts > 0,
        postCount: stats.totalPosts,
        oldestPost: stats.oldestPost,
        newestPost: stats.newestPost,
        lastUpdate: stats.lastUpdate
      }
    } catch (error) {
      console.error('Failed to get IndexedDB cache info:', error)
      return {
        hasCache: false,
        postCount: 0,
        oldestPost: null,
        newestPost: null,
        lastUpdate: null
      }
    }
  }
}