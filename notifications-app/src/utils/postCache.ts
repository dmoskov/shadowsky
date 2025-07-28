import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCacheService } from '../services/post-cache-service'
import { debug } from '@bsky/shared'

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
        debug.error('Failed to initialize PostCacheService:', error)
      })
    }
    return this.initPromise
  }

  static save(posts: Post[]): void {
    // Fire and forget - save to IndexedDB asynchronously
    this.ensureInit().then(() => {
      return this.cacheService.cachePosts(posts)
    }).then(() => {
      debug.log(`📮 Cached ${posts.length} posts to IndexedDB`)
    }).catch(error => {
      debug.error('Failed to cache posts to IndexedDB:', error)
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
      
      debug.log(`📮 Cached ${posts.length} new posts to localStorage (fallback)`)
    } catch (error) {
      debug.error('Failed to cache posts to localStorage:', error)
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
        debug.log('Post cache version mismatch, clearing')
        this.clear()
        return null
      }
      
      // Check if cache is expired
      if (Date.now() - cachedData.timestamp > POST_CACHE_DURATION) {
        debug.log('Post cache expired, clearing')
        this.clear()
        return null
      }
      
      return cachedData
    } catch (error) {
      debug.error('Failed to load cached posts:', error)
      this.clear()
      return null
    }
  }

  static getCachedPosts(uris: string[]): { cached: Post[], missing: string[] } {
    // Try to get from memory cache first (synchronous check)
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
      debug.log(`📮 Found ${cached.length} cached posts out of ${uris.length} requested from localStorage`)
    }
    
    // Asynchronously check IndexedDB for missing posts in the background
    if (missing.length > 0) {
      this.checkIndexedDBForMissingPosts(missing).catch(error => {
        debug.error('Failed to check IndexedDB for missing posts:', error)
      })
    }
    
    return { cached, missing }
  }
  
  private static async checkIndexedDBForMissingPosts(uris: string[]): Promise<void> {
    try {
      await this.ensureInit()
      const indexedDBPosts = await this.cacheService.getPosts(uris)
      if (indexedDBPosts.length > 0) {
        debug.log(`📮 Found ${indexedDBPosts.length} posts in IndexedDB that were missing from localStorage`)
        // Save them to localStorage for next time
        this.saveToLocalStorage(indexedDBPosts)
      }
    } catch (error) {
      debug.error('Failed to check IndexedDB for posts:', error)
    }
  }

  static clear(): void {
    try {
      const cacheKey = this.getCacheKey()
      localStorage.removeItem(cacheKey)
      
      // Also clear IndexedDB asynchronously
      this.ensureInit().then(() => {
        return this.cacheService.clearCache()
      }).catch(error => {
        debug.error('Failed to clear IndexedDB post cache:', error)
      })
      
      debug.log('🗑️ Cleared post cache')
    } catch (error) {
      debug.error('Failed to clear post cache:', error)
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
      debug.error('Failed to get IndexedDB cache info:', error)
      return {
        hasCache: false,
        postCount: 0,
        oldestPost: null,
        newestPost: null,
        lastUpdate: null
      }
    }
  }
  
  /**
   * Get cached posts asynchronously from IndexedDB
   * This should be used by new code that can handle async operations
   */
  static async getCachedPostsAsync(uris: string[]): Promise<{ cached: Post[], missing: string[] }> {
    try {
      await this.ensureInit()
      
      // First check IndexedDB
      const indexedDBPosts = await this.cacheService.getPosts(uris)
      const foundUris = new Set(indexedDBPosts.map(p => p.uri))
      const missing = uris.filter(uri => !foundUris.has(uri))
      
      if (indexedDBPosts.length > 0) {
        debug.log(`📮 Found ${indexedDBPosts.length} cached posts out of ${uris.length} requested from IndexedDB`)
      }
      
      // If we found all posts in IndexedDB, return them
      if (missing.length === 0) {
        return { cached: indexedDBPosts, missing: [] }
      }
      
      // Otherwise, check localStorage for any missing posts
      const localData = this.loadFromLocalStorage()
      if (localData) {
        const additionalPosts: Post[] = []
        const stillMissing: string[] = []
        
        missing.forEach(uri => {
          const post = localData.posts[uri]
          if (post) {
            additionalPosts.push(post)
            // Also save to IndexedDB for next time
            this.cacheService.cachePosts([post]).catch(console.error)
          } else {
            stillMissing.push(uri)
          }
        })
        
        if (additionalPosts.length > 0) {
          debug.log(`📮 Found ${additionalPosts.length} additional posts from localStorage`)
        }
        
        return {
          cached: [...indexedDBPosts, ...additionalPosts],
          missing: stillMissing
        }
      }
      
      return { cached: indexedDBPosts, missing }
    } catch (error) {
      debug.error('Failed to get cached posts from IndexedDB:', error)
      // Fall back to synchronous localStorage check
      return this.getCachedPosts(uris)
    }
  }
}