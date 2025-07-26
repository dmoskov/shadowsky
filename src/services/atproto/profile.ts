/**
 * Profile service with rate limiting and caching
 */

import { BskyAgent } from '@atproto/api'
import type { AppBskyActorDefs } from '@atproto/api'
import { rateLimiters } from './rate-limiter'

interface ProfileCache {
  profile: AppBskyActorDefs.ProfileView
  fetchedAt: number
}

export class ProfileService {
  private cache = new Map<string, ProfileCache>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes
  private batchQueue = new Map<string, Promise<AppBskyActorDefs.ProfileView | null>>()

  constructor(private agent: BskyAgent) {}

  /**
   * Get a single profile with rate limiting and caching
   */
  async getProfile(handle: string): Promise<AppBskyActorDefs.ProfileView | null> {
    // Check cache first
    const cached = this.cache.get(handle)
    if (cached && Date.now() - cached.fetchedAt < this.cacheTimeout) {
      return cached.profile
    }

    // Check if already fetching
    const existing = this.batchQueue.get(handle)
    if (existing) {
      return existing
    }

    // Create rate-limited fetch
    const promise = rateLimiters.profile.execute(async () => {
      try {
        const response = await this.agent.getProfile({ actor: handle })
        const profile = response.data
        
        // Cache the result
        this.cache.set(handle, {
          profile,
          fetchedAt: Date.now()
        })
        
        return profile
      } catch (error) {
        console.error(`Failed to fetch profile for ${handle}:`, error)
        return null
      }
    })

    // Store in batch queue to prevent duplicate requests
    this.batchQueue.set(handle, promise)
    
    try {
      const result = await promise
      return result
    } finally {
      // Clean up batch queue
      this.batchQueue.delete(handle)
    }
  }

  /**
   * Get multiple profiles with automatic batching and rate limiting
   */
  async getProfiles(handles: string[]): Promise<Map<string, AppBskyActorDefs.ProfileView | null>> {
    const results = new Map<string, AppBskyActorDefs.ProfileView | null>()
    const uniqueHandles = [...new Set(handles)]
    
    // Separate cached and uncached handles
    const uncachedHandles: string[] = []
    
    for (const handle of uniqueHandles) {
      const cached = this.cache.get(handle)
      if (cached && Date.now() - cached.fetchedAt < this.cacheTimeout) {
        results.set(handle, cached.profile)
      } else {
        uncachedHandles.push(handle)
      }
    }

    // Fetch uncached profiles with rate limiting
    if (uncachedHandles.length > 0) {
      // Process in smaller batches to avoid overwhelming the API
      const batchSize = 10 // Fetch 10 at a time
      const batches: string[][] = []
      
      for (let i = 0; i < uncachedHandles.length; i += batchSize) {
        batches.push(uncachedHandles.slice(i, i + batchSize))
      }

      // Process batches sequentially with rate limiting
      for (const batch of batches) {
        const batchPromises = batch.map(handle => 
          this.getProfile(handle).then(profile => ({ handle, profile }))
        )
        
        const batchResults = await Promise.all(batchPromises)
        
        for (const { handle, profile } of batchResults) {
          results.set(handle, profile)
        }
      }
    }

    return results
  }

  /**
   * Get profiles with priority (for UI responsiveness)
   */
  async getProfileWithPriority(handle: string, priority: number): Promise<AppBskyActorDefs.ProfileView | null> {
    // Check cache first
    const cached = this.cache.get(handle)
    if (cached && Date.now() - cached.fetchedAt < this.cacheTimeout) {
      return cached.profile
    }

    // Execute with priority
    return rateLimiters.profile.execute(async () => {
      try {
        const response = await this.agent.getProfile({ actor: handle })
        const profile = response.data
        
        // Cache the result
        this.cache.set(handle, {
          profile,
          fetchedAt: Date.now()
        })
        
        return profile
      } catch (error) {
        console.error(`Failed to fetch profile for ${handle}:`, error)
        return null
      }
    }, priority)
  }

  /**
   * Clear cache for a specific handle or all handles
   */
  clearCache(handle?: string) {
    if (handle) {
      this.cache.delete(handle)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0
    
    for (const [_, cached] of this.cache) {
      if (now - cached.fetchedAt < this.cacheTimeout) {
        validEntries++
      } else {
        expiredEntries++
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      queueSize: rateLimiters.profile.getQueueSize()
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now()
    const entriesToDelete: string[] = []
    
    for (const [handle, cached] of this.cache) {
      if (now - cached.fetchedAt >= this.cacheTimeout) {
        entriesToDelete.push(handle)
      }
    }
    
    for (const handle of entriesToDelete) {
      this.cache.delete(handle)
    }
    
    return entriesToDelete.length
  }
}

// Export singleton instance getter
let profileServiceInstance: ProfileService | null = null

export function getProfileService(agent: BskyAgent): ProfileService {
  if (!profileServiceInstance) {
    profileServiceInstance = new ProfileService(agent)
    
    // Set up periodic cache cleanup
    setInterval(() => {
      profileServiceInstance?.cleanupCache()
    }, 60 * 1000) // Clean up every minute
  }
  return profileServiceInstance
}