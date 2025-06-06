import { useMutation, useQueryClient } from '@tanstack/react-query'
import { interactionsService } from '../services/atproto'
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

      // Optimistically update the post
      queryClient.setQueriesData(
        { queryKey: ['timeline'] },
        (oldData: any) => {
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
                      likeCount: isLiked 
                        ? Math.max(0, (item.post.likeCount || 0) - 1)
                        : (item.post.likeCount || 0) + 1,
                      viewer: {
                        ...item.post.viewer,
                        like: isLiked ? undefined : 'optimistic-like'
                      }
                    }
                  }
                }
                return item
              })
            }))
          }
        }
      )
    },
    onSuccess: (data, { post }) => {
      // Update with the real like URI if it was a like action
      if (data.action === 'like' && data.uri) {
        queryClient.setQueriesData(
          { queryKey: ['timeline'] },
          (oldData: any) => {
            if (!oldData) return oldData

            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                feed: page.feed.map((item: FeedItem) => {
                  if (item.post.uri === post.uri && item.post.viewer?.like === 'optimistic-like') {
                    return {
                      ...item,
                      post: {
                        ...item.post,
                        viewer: {
                          ...item.post.viewer,
                          like: data.uri
                        }
                      }
                    }
                  }
                  return item
                })
              }))
            }
          }
        )
      }
    },
    onError: (error, { post }) => {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      handleError(error)
    }
  })

  // Repost mutation
  const repostMutation = useMutation({
    mutationFn: async ({ post, isReposted }: { post: Post; isReposted: boolean }) => {
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

      // Optimistically update the post
      queryClient.setQueriesData(
        { queryKey: ['timeline'] },
        (oldData: any) => {
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
        }
      )
    },
    onSuccess: (data, { post }) => {
      // Update with the real repost URI if it was a repost action
      if (data.action === 'repost' && data.uri) {
        queryClient.setQueriesData(
          { queryKey: ['timeline'] },
          (oldData: any) => {
            if (!oldData) return oldData

            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                feed: page.feed.map((item: FeedItem) => {
                  if (item.post.uri === post.uri && item.post.viewer?.repost === 'optimistic-repost') {
                    return {
                      ...item,
                      post: {
                        ...item.post,
                        viewer: {
                          ...item.post.viewer,
                          repost: data.uri
                        }
                      }
                    }
                  }
                  return item
                })
              }))
            }
          }
        )
      }
    },
    onError: (error, { post }) => {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      handleError(error)
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