import { AppBskyFeedDefs } from '@atproto/api'
import { PostStorageDB } from './post-storage-db'

type Post = AppBskyFeedDefs.PostView

export interface PostCacheResult {
  posts: Post[]
  totalCached: number
  lastUpdate: number
}

export class PostCacheService {
  private static instance: PostCacheService
  private db: PostStorageDB
  private initialized = false
  
  private constructor() {
    this.db = PostStorageDB.getInstance()
  }
  
  static getInstance(): PostCacheService {
    if (!PostCacheService.instance) {
      PostCacheService.instance = new PostCacheService()
    }
    return PostCacheService.instance
  }
  
  async init(): Promise<void> {
    if (this.initialized) return
    
    await this.db.init()
    
    // Attempt migration from localStorage
    const migrated = await this.db.migrateFromLocalStorage()
    if (migrated) {
      console.log('Successfully migrated posts from localStorage to IndexedDB')
    }
    
    this.initialized = true
  }
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('PostCacheService not initialized. Call init() first.')
    }
  }
  
  async isIndexedDBReady(): Promise<boolean> {
    return this.initialized
  }
  
  // Cache new posts
  async cachePosts(posts: Post[]): Promise<void> {
    this.ensureInitialized()
    
    // Save posts
    await this.db.savePosts(posts)
    
    // Update metadata
    const meta = await this.db.getMetadata() || {
      id: 'main',
      lastUpdate: Date.now(),
      totalCount: 0
    }
    
    meta.lastUpdate = Date.now()
    meta.totalCount = await this.getTotalCount()
    
    await this.db.saveMetadata(meta)
  }
  
  // Get a single post by URI
  async getPost(uri: string): Promise<Post | null> {
    this.ensureInitialized()
    return this.db.getPost(uri)
  }
  
  // Get multiple posts by URIs
  async getPosts(uris: string[]): Promise<Post[]> {
    this.ensureInitialized()
    return this.db.getPosts(uris)
  }
  
  // Get all cached posts
  async getAllCachedPosts(limit = 1000, offset = 0): Promise<PostCacheResult> {
    this.ensureInitialized()
    
    const posts = await this.db.getAllPosts(limit, offset)
    const meta = await this.db.getMetadata()
    const totalCount = await this.getTotalCount()
    
    return {
      posts,
      totalCached: totalCount,
      lastUpdate: meta?.lastUpdate || 0
    }
  }
  
  // Check if we have cached posts
  async hasCachedPosts(): Promise<boolean> {
    if (!this.initialized) return false
    const count = await this.getTotalCount()
    return count > 0
  }
  
  // Get total count of cached posts
  async getTotalCount(): Promise<number> {
    this.ensureInitialized()
    return this.db.getCount()
  }
  
  // Get cache statistics
  async getCacheStats(): Promise<{
    totalPosts: number
    oldestPost: Date | null
    newestPost: Date | null
    lastUpdate: Date | null
  }> {
    this.ensureInitialized()
    
    const totalPosts = await this.getTotalCount()
    const oldestPost = await this.db.getOldestPost()
    const newestPost = await this.db.getNewestPost()
    const meta = await this.db.getMetadata()
    
    return {
      totalPosts,
      oldestPost: oldestPost ? new Date(oldestPost.indexedAt) : null,
      newestPost: newestPost ? new Date(newestPost.indexedAt) : null,
      lastUpdate: meta?.lastUpdate ? new Date(meta.lastUpdate) : null
    }
  }
  
  // Clear all cached posts
  async clearCache(): Promise<void> {
    this.ensureInitialized()
    await this.db.clearAll()
  }
  
  // Clean up old posts (older than specified days)
  async cleanupOldPosts(daysToKeep = 7): Promise<number> {
    this.ensureInitialized()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    return this.db.deletePostsOlderThan(cutoffDate)
  }
}