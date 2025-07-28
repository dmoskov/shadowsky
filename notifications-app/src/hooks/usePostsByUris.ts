import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import type { AppBskyFeedDefs } from '@atproto/api'
import { rateLimitedPostFetch } from '../services/rate-limiter'
import { PostCache } from '../utils/postCache'
import { debug } from '@bsky/shared'

type Post = AppBskyFeedDefs.PostView

/**
 * Hook to fetch posts by their URIs
 */
export function usePostsByUris(uris: string[]) {
  const { session } = useAuth()

  // Create a stable query key based on sorted URIs
  const queryKey = ['posts-by-uris', uris.slice().sort().join(',')]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (uris.length === 0) return []
      
      // Check cache first (using async method for IndexedDB)
      const { cached, missing } = await PostCache.getCachedPostsAsync(uris)
      
      // If we have all posts cached, return them immediately
      if (missing.length === 0) {
        debug.log(`🎯 All ${cached.length} root posts found in cache`)
        return cached
      }
      
      debug.log(`🎯 Found ${cached.length} cached root posts, fetching ${missing.length} from API`)
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // Batch fetch missing posts (Bluesky API supports up to 25 posts per request)
      const posts: Post[] = [...cached] // Start with cached posts
      
      for (let i = 0; i < missing.length; i += 25) {
        const batch = missing.slice(i, i + 25)
        try {
          // Rate limit the API call
          const response = await rateLimitedPostFetch(async () => 
            agent.app.bsky.feed.getPosts({ uris: batch })
          )
          const newPosts = response.data.posts as Post[]
          posts.push(...newPosts)
          
          // Cache the newly fetched posts
          PostCache.save(newPosts)
        } catch (error) {
          debug.error('Failed to fetch posts batch:', error)
        }
      }
      
      return posts
    },
    enabled: !!session && uris.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes - posts don't change often
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch posts on window focus
    refetchOnMount: false, // Don't refetch when component remounts if data exists
  })
}