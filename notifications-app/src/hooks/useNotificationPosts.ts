import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { Post } from '@bsky/shared'
import { rateLimitedPostFetch } from '../services/rate-limiter'

/**
 * Hook to fetch posts referenced in notifications
 * This is used to get full post data including embeds for image filtering
 */
export function useNotificationPosts(notifications: Notification[] | undefined) {
  const { session } = useAuth()

  // Create a stable query key based on unique post URIs, not the full notification list
  const postUris = React.useMemo(() => {
    if (!notifications || notifications.length === 0) return []
    
    // Separate URIs by notification type to prioritize reposts
    const repostUris = new Set<string>()
    const otherUris = new Set<string>()
    let repostCount = 0
    
    notifications.forEach(notification => {
      if (['like', 'repost', 'reply', 'quote'].includes(notification.reason)) {
        if (notification.reason === 'repost') {
          // For reposts, use reasonSubject which contains the original post URI
          if (notification.reasonSubject) {
            repostUris.add(notification.reasonSubject)
          } else {
            // Fallback to uri if reasonSubject is not available
            repostUris.add(notification.uri)
          }
          repostCount++
        } else {
          otherUris.add(notification.uri)
        }
      }
    })
    
    // Prioritize repost URIs by putting them first
    const allUris = [...Array.from(repostUris), ...Array.from(otherUris)]
    
    console.log(`[POST URIS] Total notifications: ${notifications.length}, Repost notifications: ${repostCount}, Repost URIs: ${repostUris.size}, Other URIs: ${otherUris.size}, Total unique URIs: ${allUris.length}`)
    
    return allUris
  }, [notifications])

  return useQuery({
    queryKey: ['notification-posts', postUris.slice(0, 100).sort().join(',')], // Limit key size, sort for stability
    queryFn: async () => {
      if (postUris.length === 0) return []
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // LIMIT: Fetch first 150 posts to ensure reposts are included (they're prioritized first)
      const MAX_POSTS_TO_FETCH = 150
      const urisToFetch = postUris.slice(0, MAX_POSTS_TO_FETCH)
      
      console.log(`[POST FETCH] Fetching ${urisToFetch.length} unique posts (limited from ${postUris.length})`)
      
      // Batch fetch posts (Bluesky API supports up to 25 posts per request)
      const posts: Post[] = []
      let apiCallCount = 0
      
      for (let i = 0; i < urisToFetch.length; i += 25) {
        const batch = urisToFetch.slice(i, i + 25)
        try {
          apiCallCount++
          // Rate limit the API call
          const response = await rateLimitedPostFetch(async () => 
            agent.app.bsky.feed.getPosts({ uris: batch })
          )
          posts.push(...(response.data.posts as Post[]))
        } catch (error) {
          console.error('Failed to fetch posts batch:', error)
        }
      }
      
      console.log(`[POST FETCH] Made ${apiCallCount} API calls to fetch ${posts.length} posts`)
      return posts
    },
    enabled: !!session && postUris.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes - posts don't change often
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch posts on window focus
    refetchOnMount: false, // Don't refetch when component remounts if data exists
  })
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