import type { AppBskyActorDefs } from '@atproto/api'
import { debug } from '@bsky/shared'

// Database schema types
export interface CachedProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  followersCount: number
  followingCount: number
  postsCount: number
  description?: string
  
  // Cache metadata
  lastFetched: Date
  lastInteraction?: Date
  fromCache?: boolean  // Track if this data came from cache or API
}

export interface InteractionStats {
  did: string
  handle: string
  
  // Interaction counts
  totalInteractions: number
  likes: number
  reposts: number
  follows: number
  replies: number
  mentions: number
  quotes: number
  
  // Interaction details
  latestInteractionAt: Date
  firstInteractionAt: Date
  
  // Post URIs for each interaction type
  likedPosts: string[]
  repostedPosts: string[]
  repliedPosts: string[]
  quotedPosts: string[]
}

// Cache configuration
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 1 week

// Main database class
export class FollowerCacheDB {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'BlueskyFollowerCache'
  private readonly DB_VERSION = 1
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Cached profiles store
        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', { keyPath: 'did' })
          profileStore.createIndex('handle', 'handle', { unique: true })
          profileStore.createIndex('followersCount', 'followersCount', { unique: false })
          profileStore.createIndex('lastFetched', 'lastFetched', { unique: false })
        }
        
        // Interaction stats store
        if (!db.objectStoreNames.contains('interactions')) {
          const interactionStore = db.createObjectStore('interactions', { keyPath: 'did' })
          interactionStore.createIndex('handle', 'handle', { unique: true })
          interactionStore.createIndex('totalInteractions', 'totalInteractions', { unique: false })
          interactionStore.createIndex('latestInteractionAt', 'latestInteractionAt', { unique: false })
        }
      }
    })
  }
  
  // Profile management
  async saveProfile(profile: CachedProfile): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot save profile')
      return
    }
    const tx = this.db.transaction(['profiles'], 'readwrite')
    await tx.objectStore('profiles').put(profile)
  }
  
  async saveProfiles(profiles: CachedProfile[]): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot save profiles')
      return
    }
    const tx = this.db.transaction(['profiles'], 'readwrite')
    const store = tx.objectStore('profiles')
    
    for (const profile of profiles) {
      await store.put(profile)
    }
  }
  
  async getProfile(did: string): Promise<CachedProfile | undefined> {
    if (!this.db) {
      debug.warn('Database not initialized, returning undefined')
      return undefined
    }
    const tx = this.db.transaction(['profiles'], 'readonly')
    const request = tx.objectStore('profiles').get(did)
    const result = await request
    return result as unknown as CachedProfile | undefined
  }
  
  async getProfileByHandle(handle: string): Promise<CachedProfile | undefined> {
    if (!this.db) {
      debug.warn('Database not initialized, returning undefined')
      return undefined
    }
    const tx = this.db.transaction(['profiles'], 'readonly')
    const index = tx.objectStore('profiles').index('handle')
    const request = index.get(handle)
    return new Promise<CachedProfile | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  async getProfiles(dids: string[]): Promise<Map<string, CachedProfile>> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty map')
      return new Map<string, CachedProfile>()
    }
    const tx = this.db.transaction(['profiles'], 'readonly')
    const store = tx.objectStore('profiles')
    const profileMap = new Map<string, CachedProfile>()
    
    for (const did of dids) {
      const request = store.get(did)
      const profile = await new Promise<CachedProfile | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as CachedProfile | undefined)
        request.onerror = () => reject(request.error)
      })
      if (profile) {
        profileMap.set(did, profile)
      }
    }
    
    return profileMap
  }
  
  async getProfilesByHandles(handles: string[]): Promise<Map<string, CachedProfile>> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty map')
      return new Map<string, CachedProfile>()
    }
    
    const tx = this.db.transaction(['profiles'], 'readonly')
    const index = tx.objectStore('profiles').index('handle')
    const profileMap = new Map<string, CachedProfile>()
    
    for (const handle of handles) {
      const request = index.get(handle)
      const profile = await new Promise<CachedProfile | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as CachedProfile | undefined)
        request.onerror = () => reject(request.error)
      })
      if (profile) {
        profileMap.set(handle, profile)
      }
    }
    
    return profileMap
  }
  
  async isProfileStale(did: string): Promise<boolean> {
    const profile = await this.getProfile(did)
    if (!profile) return true
    
    const now = new Date()
    const age = now.getTime() - profile.lastFetched.getTime()
    return age > CACHE_DURATION_MS
  }
  
  async getStaleProfiles(dids: string[]): Promise<string[]> {
    const staleProfiles: string[] = []
    
    for (const did of dids) {
      if (await this.isProfileStale(did)) {
        staleProfiles.push(did)
      }
    }
    
    return staleProfiles
  }
  
  async getTopProfiles(minFollowers: number, limit: number = 100): Promise<CachedProfile[]> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty array')
      return []
    }
    const tx = this.db.transaction(['profiles'], 'readonly')
    const index = tx.objectStore('profiles').index('followersCount')
    
    const profiles: CachedProfile[] = []
    
    return new Promise((resolve, reject) => {
      // Open cursor in descending order
      const request = index.openCursor(null, 'prev')
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && profiles.length < limit) {
          const profile = cursor.value as CachedProfile
          if (profile.followersCount >= minFollowers) {
            profiles.push(profile)
          }
          cursor.continue()
        } else {
          resolve(profiles)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  // Interaction stats management
  async saveInteractionStats(stats: InteractionStats): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot save interaction stats')
      return
    }
    const tx = this.db.transaction(['interactions'], 'readwrite')
    await tx.objectStore('interactions').put(stats)
  }
  
  async saveMultipleInteractionStats(statsList: InteractionStats[]): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot save interaction stats')
      return
    }
    const tx = this.db.transaction(['interactions'], 'readwrite')
    const store = tx.objectStore('interactions')
    
    // Create all put operations
    const promises = statsList.map(stats => store.put(stats))
    
    // Wait for all operations to complete
    await Promise.all(promises)
    
    // Wait for the transaction to complete
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  
  async getInteractionStats(did: string): Promise<InteractionStats | undefined> {
    if (!this.db) {
      debug.warn('Database not initialized, returning undefined')
      return undefined
    }
    const tx = this.db.transaction(['interactions'], 'readonly')
    const request = tx.objectStore('interactions').get(did)
    const result = await new Promise<InteractionStats | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as InteractionStats | undefined)
      request.onerror = () => reject(request.error)
    })
    return result
  }
  
  async getInteractionStatsForMultiple(dids: string[]): Promise<Map<string, InteractionStats>> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty map')
      return new Map<string, InteractionStats>()
    }
    const tx = this.db.transaction(['interactions'], 'readonly')
    const store = tx.objectStore('interactions')
    const statsMap = new Map<string, InteractionStats>()
    
    for (const did of dids) {
      const request = store.get(did)
      const stats = await new Promise<InteractionStats | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as InteractionStats | undefined)
        request.onerror = () => reject(request.error)
      })
      if (stats) {
        statsMap.set(did, stats)
      }
    }
    
    return statsMap
  }
  
  async getTopInteractors(limit: number = 100): Promise<InteractionStats[]> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty array')
      return []
    }
    const tx = this.db.transaction(['interactions'], 'readonly')
    const index = tx.objectStore('interactions').index('totalInteractions')
    
    const interactors: InteractionStats[] = []
    
    return new Promise((resolve, reject) => {
      // Open cursor in descending order
      const request = index.openCursor(null, 'prev')
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && interactors.length < limit) {
          interactors.push(cursor.value)
          cursor.continue()
        } else {
          resolve(interactors)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async updateInteractionStats(
    did: string,
    updates: Partial<InteractionStats>
  ): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot update interaction stats')
      return
    }
    const tx = this.db.transaction(['interactions'], 'readwrite')
    const store = tx.objectStore('interactions')
    
    const existing = await store.get(did)
    if (existing) {
      const updated = { ...existing, ...updates }
      await store.put(updated)
    } else if (updates.handle) {
      // Create new record if it doesn't exist and we have required fields
      const newStats: InteractionStats = {
        did,
        handle: updates.handle,
        totalInteractions: 0,
        likes: 0,
        reposts: 0,
        follows: 0,
        replies: 0,
        mentions: 0,
        quotes: 0,
        latestInteractionAt: new Date(),
        firstInteractionAt: new Date(),
        likedPosts: [],
        repostedPosts: [],
        repliedPosts: [],
        quotedPosts: [],
        ...updates
      }
      await store.put(newStats)
    }
  }
  
  // Combined queries
  async getEnrichedProfiles(
    dids: string[], 
    minFollowers: number = 0
  ): Promise<Array<CachedProfile & { interactionStats?: InteractionStats }>> {
    const profiles = await this.getProfiles(dids)
    const interactions = await this.getInteractionStatsForMultiple(dids)
    
    const enriched: Array<CachedProfile & { interactionStats?: InteractionStats }> = []
    
    for (const [did, profile] of profiles) {
      if (profile.followersCount >= minFollowers) {
        enriched.push({
          ...profile,
          interactionStats: interactions.get(did)
        })
      }
    }
    
    // Sort by follower count descending
    return enriched.sort((a, b) => b.followersCount - a.followersCount)
  }
  
  // Utility methods
  async clearCache(): Promise<void> {
    if (!this.db) {
      debug.error('Database not initialized, cannot clear cache')
      return
    }
    const tx = this.db.transaction(['profiles', 'interactions'], 'readwrite')
    await tx.objectStore('profiles').clear()
    await tx.objectStore('interactions').clear()
  }
  
  async clearStaleProfiles(): Promise<number> {
    if (!this.db) {
      debug.warn('Database not initialized, cannot clear stale profiles')
      return 0
    }
    const tx = this.db.transaction(['profiles'], 'readwrite')
    const store = tx.objectStore('profiles')
    const index = store.index('lastFetched')
    
    const cutoffDate = new Date(Date.now() - CACHE_DURATION_MS)
    const range = IDBKeyRange.upperBound(cutoffDate)
    
    let deletedCount = 0
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range)
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async getStats(): Promise<{
    totalProfiles: number
    totalInteractions: number
    staleProfiles: number
    cacheSize: number
  }> {
    if (!this.db) {
      debug.warn('Database not initialized, returning empty stats')
      return {
        totalProfiles: 0,
        totalInteractions: 0,
        staleProfiles: 0,
        cacheSize: 0
      }
    }
    
    const tx = this.db.transaction(['profiles', 'interactions'], 'readonly')
    
    const profileCountRequest = tx.objectStore('profiles').count()
    const interactionCountRequest = tx.objectStore('interactions').count()
    
    const profileCount = (await profileCountRequest) as unknown as number
    const interactionCount = (await interactionCountRequest) as unknown as number
    
    // Count stale profiles
    const profileStore = tx.objectStore('profiles')
    const cutoffDate = new Date(Date.now() - CACHE_DURATION_MS)
    const staleRange = IDBKeyRange.upperBound(cutoffDate)
    const staleCountRequest = profileStore.index('lastFetched').count(staleRange)
    const staleCount = (await staleCountRequest) as unknown as number
    
    // Estimate cache size (rough approximation)
    const avgProfileSize = 500 // bytes
    const avgInteractionSize = 1000 // bytes
    const estimatedSize = (profileCount * avgProfileSize) + (interactionCount * avgInteractionSize)
    
    return {
      totalProfiles: profileCount,
      totalInteractions: interactionCount,
      staleProfiles: staleCount,
      cacheSize: estimatedSize
    }
  }
}

// Singleton instance
let dbInstance: FollowerCacheDB | null = null
let initializationPromise: Promise<FollowerCacheDB> | null = null

export async function getFollowerCacheDB(): Promise<FollowerCacheDB> {
  if (!dbInstance) {
    // If we're already initializing, wait for that to complete
    if (initializationPromise) {
      return initializationPromise
    }
    
    // Start initialization
    initializationPromise = (async () => {
      dbInstance = new FollowerCacheDB()
      await dbInstance.initialize()
      return dbInstance
    })()
    
    return initializationPromise
  }
  return dbInstance
}

// Helper function to convert AT Protocol profile to cached profile
export function profileToCached(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  lastInteraction?: Date
): CachedProfile {
  return {
    did: profile.did,
    handle: profile.handle,
    displayName: profile.displayName,
    avatar: profile.avatar,
    followersCount: profile.followersCount || 0,
    followingCount: profile.followsCount || 0,
    postsCount: profile.postsCount || 0,
    description: profile.description,
    lastFetched: new Date(),
    lastInteraction
  }
}