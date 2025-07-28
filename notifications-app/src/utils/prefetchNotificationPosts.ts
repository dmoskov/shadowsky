import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCache } from './postCache'
import { rateLimitedPostFetch } from '../services/rate-limiter'

type Post = AppBskyFeedDefs.PostView

/**
 * Prefetch posts for notifications to ensure they're cached before the UI needs them
 * Focuses on reply notifications which are used in the Conversations tab
 */
export async function prefetchNotificationPosts(
  notifications: Notification[], 
  agent: any,
  onProgress?: (fetched: number, total: number) => void
): Promise<void> {
  // Extract unique post URIs from notifications that need posts
  const postUrisSet = new Set<string>()
  
  notifications.forEach(notification => {
    // For replies, we need the post data
    if (notification.reason === 'reply') {
      postUrisSet.add(notification.uri)
      
      // Also add the reasonSubject which might be the root post
      if (notification.reasonSubject) {
        postUrisSet.add(notification.reasonSubject)
      }
    }
    
    // For reposts and likes, we need the original post
    if ((notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject) {
      postUrisSet.add(notification.reasonSubject)
    }
    
    // For quotes, we need the quote post
    if (notification.reason === 'quote') {
      postUrisSet.add(notification.uri)
    }
  })
  
  const postUris = Array.from(postUrisSet)
  if (postUris.length === 0) return
  
  console.log(`🔄 Prefetching ${postUris.length} posts for notifications`)
  
  // Check what's already cached
  const { cached, missing } = await PostCache.getCachedPostsAsync(postUris)
  
  if (missing.length === 0) {
    console.log(`✅ All ${cached.length} posts already cached`)
    return
  }
  
  console.log(`📥 Need to fetch ${missing.length} posts (${cached.length} already cached)`)
  
  // Batch fetch missing posts
  let fetchedCount = 0
  
  for (let i = 0; i < missing.length; i += 25) {
    const batch = missing.slice(i, i + 25)
    
    try {
      const response = await rateLimitedPostFetch(async () => 
        agent.app.bsky.feed.getPosts({ uris: batch })
      )
      
      const posts = response.data.posts as Post[]
      
      // Cache the fetched posts
      if (posts.length > 0) {
        PostCache.save(posts)
        fetchedCount += posts.length
        
        if (onProgress) {
          onProgress(fetchedCount, missing.length)
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (i + 25 < missing.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error('Failed to prefetch posts batch:', error)
    }
  }
  
  console.log(`✅ Prefetched ${fetchedCount} posts for notifications`)
}

/**
 * Extract root post URIs from reply notifications for thread reconstruction
 */
export async function extractRootPostUris(
  notifications: Notification[],
  agent: any
): Promise<string[]> {
  const rootUris = new Set<string>()
  const replyUris = notifications
    .filter(n => n.reason === 'reply')
    .map(n => n.uri)
  
  if (replyUris.length === 0) return []
  
  // First check cache for reply posts
  const { cached, missing } = await PostCache.getCachedPostsAsync(replyUris)
  
  // Extract root URIs from cached posts
  cached.forEach(post => {
    const record = post.record as any
    if (record?.reply?.root?.uri) {
      rootUris.add(record.reply.root.uri)
    }
  })
  
  // Fetch missing reply posts to get their root URIs
  if (missing.length > 0) {
    console.log(`🔍 Fetching ${missing.length} reply posts to find root URIs`)
    
    for (let i = 0; i < missing.length; i += 25) {
      const batch = missing.slice(i, i + 25)
      
      try {
        const response = await rateLimitedPostFetch(async () => 
          agent.app.bsky.feed.getPosts({ uris: batch })
        )
        
        const posts = response.data.posts as Post[]
        
        // Cache these posts and extract root URIs
        if (posts.length > 0) {
          PostCache.save(posts)
          
          posts.forEach(post => {
            const record = post.record as any
            if (record?.reply?.root?.uri) {
              rootUris.add(record.reply.root.uri)
            }
          })
        }
      } catch (error) {
        console.error('Failed to fetch reply posts batch:', error)
      }
    }
  }
  
  return Array.from(rootUris)
}

/**
 * Prefetch root posts for conversation threads
 */
export async function prefetchRootPosts(
  notifications: Notification[],
  agent: any
): Promise<void> {
  const rootUris = await extractRootPostUris(notifications, agent)
  
  if (rootUris.length === 0) return
  
  console.log(`🌳 Prefetching ${rootUris.length} root posts for conversations`)
  
  // Check what's already cached
  const { cached, missing } = await PostCache.getCachedPostsAsync(rootUris)
  
  if (missing.length === 0) {
    console.log(`✅ All ${cached.length} root posts already cached`)
    return
  }
  
  console.log(`📥 Need to fetch ${missing.length} root posts`)
  
  // Fetch missing root posts
  let fetchedCount = 0
  
  for (let i = 0; i < missing.length; i += 25) {
    const batch = missing.slice(i, i + 25)
    
    try {
      const response = await rateLimitedPostFetch(async () => 
        agent.app.bsky.feed.getPosts({ uris: batch })
      )
      
      const posts = response.data.posts as Post[]
      
      if (posts.length > 0) {
        PostCache.save(posts)
        fetchedCount += posts.length
      }
    } catch (error) {
      console.error('Failed to fetch root posts batch:', error)
    }
  }
  
  console.log(`✅ Prefetched ${fetchedCount} root posts`)
}