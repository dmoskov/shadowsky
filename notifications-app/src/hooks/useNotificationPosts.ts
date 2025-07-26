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
    
    const uniqueUris = new Set<string>()
    notifications.forEach(notification => {
      if (['like', 'repost', 'reply', 'quote'].includes(notification.reason)) {
        uniqueUris.add(notification.uri)
      }
    })
    
    return Array.from(uniqueUris).sort() // Sort for stable key
  }, [notifications])

  return useQuery({
    queryKey: ['notification-posts', postUris.slice(0, 100).join(',')], // Limit key size
    queryFn: async () => {
      if (postUris.length === 0) return []
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // LIMIT: Only fetch first 100 posts to reduce API calls
      const MAX_POSTS_TO_FETCH = 100
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