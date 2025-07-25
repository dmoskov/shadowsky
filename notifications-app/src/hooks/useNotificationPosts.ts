import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { Post } from '@bsky/shared'

/**
 * Hook to fetch posts referenced in notifications
 * This is used to get full post data including embeds for image filtering
 */
export function useNotificationPosts(notifications: Notification[] | undefined) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['notification-posts', notifications?.map(n => n.uri).join(',')],
    queryFn: async () => {
      if (!notifications || notifications.length === 0) return []
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // Get unique post URIs from notifications
      // For likes, reposts, replies, and quotes, the URI refers to the original post
      const postUris = new Set<string>()
      
      notifications.forEach(notification => {
        if (['like', 'repost', 'reply', 'quote'].includes(notification.reason)) {
          // For these notifications, the uri field contains the post URI
          postUris.add(notification.uri)
        }
      })
      
      if (postUris.size === 0) return []
      
      // Batch fetch posts (Bluesky API supports up to 25 posts per request)
      const urisArray = Array.from(postUris)
      const posts: Post[] = []
      
      for (let i = 0; i < urisArray.length; i += 25) {
        const batch = urisArray.slice(i, i + 25)
        try {
          const response = await agent.app.bsky.feed.getPosts({ uris: batch })
          posts.push(...(response.data.posts as Post[]))
        } catch (error) {
          console.error('Failed to fetch posts batch:', error)
        }
      }
      
      return posts
    },
    enabled: !!session && !!notifications && notifications.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
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