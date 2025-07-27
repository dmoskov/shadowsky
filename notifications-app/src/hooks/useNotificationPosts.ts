import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { AppBskyFeedDefs } from '@atproto/api'
import { PostCache } from '../utils/postCache'

type Post = AppBskyFeedDefs.PostView
import { rateLimitedPostFetch } from '../services/rate-limiter'

/**
 * Hook to fetch posts referenced in notifications
 * This is used to get full post data including embeds for image filtering
 */
export function useNotificationPosts(notifications: Notification[] | undefined) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [fetchedCount, setFetchedCount] = React.useState(0)
  const [isFetchingMore, setIsFetchingMore] = React.useState(false)

  // Create a stable query key based on unique post URIs, maintaining order
  const postUris = React.useMemo(() => {
    if (!notifications || notifications.length === 0) return []
    
    // Maintain order of notifications as they appear in the feed
    const uriSet = new Set<string>()
    const orderedUris: string[] = []
    
    notifications.forEach(notification => {
      if (['like', 'repost', 'reply', 'quote'].includes(notification.reason)) {
        // For reposts and likes, use reasonSubject which contains the original post URI
        const uri = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject
          ? notification.reasonSubject
          : notification.uri
        
        // Only add if we haven't seen this URI before
        if (!uriSet.has(uri)) {
          uriSet.add(uri)
          orderedUris.push(uri)
        }
      }
    })
    
    return orderedUris
  }, [notifications])

  const queryKey = ['notification-posts', postUris.slice(0, 100).sort().join(',')]

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (postUris.length === 0) return []
      
      // Initial fetch: Get first 150 posts quickly
      const INITIAL_POSTS_TO_FETCH = 150
      const urisToFetch = postUris.slice(0, INITIAL_POSTS_TO_FETCH)
      
      // Check cache first
      const { cached, missing } = PostCache.getCachedPosts(urisToFetch)
      
      // If we have all posts cached, return them immediately
      if (missing.length === 0) {
        setFetchedCount(cached.length)
        return cached
      }
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // Batch fetch only missing posts (Bluesky API supports up to 25 posts per request)
      const posts: Post[] = [...cached] // Start with cached posts
      let apiCallCount = 0
      
      for (let i = 0; i < missing.length; i += 25) {
        const batch = missing.slice(i, i + 25)
        try {
          apiCallCount++
          // Rate limit the API call
          const response = await rateLimitedPostFetch(async () => 
            agent.app.bsky.feed.getPosts({ uris: batch })
          )
          const newPosts = response.data.posts as Post[]
          posts.push(...newPosts)
          
          // Cache the newly fetched posts
          PostCache.save(newPosts)
        } catch (error) {
          console.error('Failed to fetch posts batch:', error)
        }
      }
      
      setFetchedCount(posts.length)
      return posts
    },
    enabled: !!session && postUris.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes - posts don't change often
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch posts on window focus
    refetchOnMount: false, // Don't refetch when component remounts if data exists
  })

  // Progressive fetch for remaining posts
  React.useEffect(() => {
    if (!session || !queryResult.data || isFetchingMore) return
    
    // Check if we have unfetched posts
    const fetchedUris = new Set((queryResult.data || []).map(post => post.uri))
    const unfetchedCount = postUris.filter(uri => !fetchedUris.has(uri)).length
    
    if (unfetchedCount === 0) return // All posts fetched

    const fetchMorePosts = async () => {
      setIsFetchingMore(true)
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) return

      const BATCH_SIZE = 50 // Fetch 50 posts at a time after initial load
      const DELAY_BETWEEN_BATCHES = 2000 // 2 seconds between batches (faster for better UX)
      
      // Get already fetched URIs from current data
      const fetchedUris = new Set((queryResult.data || []).map(post => post.uri))
      
      // Filter out URIs that have already been fetched
      const unfetchedUris = postUris.filter(uri => !fetchedUris.has(uri))
      
      // Take the next batch of unfetched URIs in order (which naturally prioritizes top posts)
      const urisToFetch = unfetchedUris.slice(0, BATCH_SIZE)
      
      // Check cache first for this batch
      const { cached: cachedBatch, missing: missingBatch } = PostCache.getCachedPosts(urisToFetch)
      const newPosts: Post[] = [...cachedBatch]
      
      // Only fetch missing posts from API
      if (missingBatch.length > 0) {
        for (let i = 0; i < missingBatch.length; i += 25) {
          const batch = missingBatch.slice(i, i + 25)
          try {
            const response = await rateLimitedPostFetch(async () => 
              agent.app.bsky.feed.getPosts({ uris: batch })
            )
            const fetchedPosts = response.data.posts as Post[]
            newPosts.push(...fetchedPosts)
            
            // Cache the newly fetched posts
            PostCache.save(fetchedPosts)
            
            // Small delay between API calls within a batch
            if (i + 25 < missingBatch.length) {
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (error) {
            console.error('Failed to fetch additional posts batch:', error)
          }
        }
      }

      // Update the query data with new posts
      if (newPosts.length > 0) {
        queryClient.setQueryData(queryKey, (oldData: Post[] | undefined) => {
          const updatedData = [...(oldData || []), ...newPosts]
          return updatedData
        })
        setFetchedCount(prev => prev + newPosts.length)
      }

      setIsFetchingMore(false)

      // Schedule next batch if there are more unfetched posts
      if (unfetchedUris.length > BATCH_SIZE) {
        setTimeout(fetchMorePosts, DELAY_BETWEEN_BATCHES)
      }
    }

    // Start fetching more posts after a delay
    const timeoutId = setTimeout(fetchMorePosts, 2000)
    return () => clearTimeout(timeoutId)
  }, [session, queryResult.data, fetchedCount, postUris, isFetchingMore, queryClient, queryKey])

  // Calculate actual fetched count based on current data
  const actualFetchedCount = queryResult.data?.length || 0
  
  return {
    ...queryResult,
    totalPosts: postUris.length,
    fetchedPosts: actualFetchedCount,
    isFetchingMore,
    percentageFetched: postUris.length > 0 ? Math.round((actualFetchedCount / postUris.length) * 100) : 100
  }
}

/**
 * Check if a post has image embeds
 */
export function postHasImages(post: Post): boolean {
  if (!post.embed) return false
  
  const embed = post.embed as any
  
  // Check for direct image embed
  if (embed.$type === 'app.bsky.embed.images#view') {
    return true
  }
  
  // Check for images in record with media embed
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && 
      embed.media?.$type === 'app.bsky.embed.images#view') {
    return true
  }
  
  return false
}