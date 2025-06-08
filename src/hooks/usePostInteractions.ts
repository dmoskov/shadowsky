import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getInteractionsService } from '../services/atproto'
import type { Post, FeedItem } from '../types/atproto'
import { useErrorHandler } from './useErrorHandler'

export interface UsePostInteractionsReturn {
  likePost: (post: Post) => Promise<void>
  unlikePost: (post: Post) => Promise<void>
  repostPost: (post: Post) => Promise<void>
  deleteRepost: (post: Post) => Promise<void>
  isLiking: boolean
  isReposting: boolean
}

export function usePostInteractions(): UsePostInteractionsReturn {
  const queryClient = useQueryClient()
  const { handleError } = useErrorHandler()

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({ post, isLiked }: { post: Post; isLiked: boolean }) => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.getAgent()
      if (!agent) throw new Error('Not authenticated')
      const interactionsService = getInteractionsService(agent)
      
      if (isLiked && post.viewer?.like) {
        await interactionsService.unlikePost(post.viewer.like)
        return { action: 'unlike' }
      } else {
        const result = await interactionsService.likePost(post)
        return { action: 'like', uri: result.uri }
      }
    },
    onMutate: async ({ post, isLiked }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['timeline'] })

      // Get the previous data
      const previousData = queryClient.getQueryData(['timeline'])

      // Optimistically update the post
      queryClient.setQueryData(['timeline'], (oldData: any) => {
        if (!oldData) return oldData

        // Create a deep copy to ensure React Query detects the change
        const newData = {
          ...oldData,
          pages: oldData.pages.map((page: any, pageIndex: number) => ({
            ...page,
            feed: page.feed.map((item: FeedItem, itemIndex: number) => {
              if (item.post.uri === post.uri) {
                const newLikeCount = isLiked 
                  ? Math.max(0, (item.post.likeCount || 0) - 1)
                  : (item.post.likeCount || 0) + 1
                  
                const updatedItem = {
                  ...item,
                  post: {
                    ...item.post,
                    likeCount: newLikeCount,
                    viewer: {
                      ...item.post.viewer,
                      like: isLiked ? undefined : 'optimistic-like'
                    }
                  }
                }
                
                return updatedItem
              }
              return item
            })
          }))
        }
        
        return newData
      })

      // Return context with previous data
      return { previousData }
    },
    onSuccess: (data, { post }) => {
      // Update with the real like URI - skip if it's just confirming optimistic update
      if (data.action === 'like' && data.uri) {
        queryClient.setQueryData(['timeline'], (oldData: any) => {
          if (!oldData) return oldData

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              feed: page.feed.map((item: FeedItem) => {
                if (item.post.uri === post.uri) {
                  const updatedPost = {
                    ...item,
                    post: {
                      ...item.post,
                      viewer: {
                        ...item.post.viewer,
                        like: data.uri
                      }
                    }
                  }
                  return updatedPost
                }
                return item
              })
            }))
          }
        })
      }
      
      // Invalidate after a delay to refresh from server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }, 2000)
    },
    onError: (error, variables, context) => {
      // Revert to previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(['timeline'], context.previousData)
      }
      handleError(error, 'likePost')
    }
  })

  // Repost mutation
  const repostMutation = useMutation({
    mutationFn: async ({ post, isReposted }: { post: Post; isReposted: boolean }) => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.getAgent()
      if (!agent) throw new Error('Not authenticated')
      const interactionsService = getInteractionsService(agent)
      
      if (isReposted && post.viewer?.repost) {
        await interactionsService.deleteRepost(post.viewer.repost)
        return { action: 'unrepost' }
      } else {
        const result = await interactionsService.repostPost(post)
        return { action: 'repost', uri: result.uri }
      }
    },
    onMutate: async ({ post, isReposted }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['timeline'] })

      // Get the previous data
      const previousData = queryClient.getQueryData(['timeline'])

      // Optimistically update the post
      queryClient.setQueryData(['timeline'], (oldData: any) => {
        if (!oldData) return oldData

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            feed: page.feed.map((item: FeedItem) => {
              if (item.post.uri === post.uri) {
                return {
                  ...item,
                  post: {
                    ...item.post,
                    repostCount: isReposted 
                      ? Math.max(0, (item.post.repostCount || 0) - 1)
                      : (item.post.repostCount || 0) + 1,
                    viewer: {
                      ...item.post.viewer,
                      repost: isReposted ? undefined : 'optimistic-repost'
                    }
                  }
                }
              }
              return item
            })
          }))
        }
      })

      return { previousData }
    },
    onSuccess: (data, { post }) => {
      // Update with the real repost URI
      queryClient.setQueryData(['timeline'], (oldData: any) => {
        if (!oldData) return oldData

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            feed: page.feed.map((item: FeedItem) => {
              if (item.post.uri === post.uri) {
                const updatedPost = {
                  ...item,
                  post: {
                    ...item.post,
                    viewer: {
                      ...item.post.viewer,
                      repost: data.action === 'repost' ? data.uri : undefined
                    }
                  }
                }
                return updatedPost
              }
              return item
            })
          }))
        }
      })
      
      // Invalidate after a delay to refresh from server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }, 2000)
    },
    onError: (error, variables, context) => {
      // Revert to previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(['timeline'], context.previousData)
      }
      handleError(error, 'repostPost')
    }
  })

  return {
    likePost: async (post: Post) => {
      const isLiked = !!post.viewer?.like
      await likeMutation.mutateAsync({ post, isLiked })
    },
    unlikePost: async (post: Post) => {
      const isLiked = !!post.viewer?.like
      if (isLiked) {
        await likeMutation.mutateAsync({ post, isLiked })
      }
    },
    repostPost: async (post: Post) => {
      const isReposted = !!post.viewer?.repost
      await repostMutation.mutateAsync({ post, isReposted })
    },
    deleteRepost: async (post: Post) => {
      const isReposted = !!post.viewer?.repost
      if (isReposted) {
        await repostMutation.mutateAsync({ post, isReposted })
      }
    },
    isLiking: likeMutation.isPending,
    isReposting: repostMutation.isPending
  }
}