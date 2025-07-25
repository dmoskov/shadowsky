import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getProfileService } from '@bsky/shared'
import { useErrorHandler } from './useErrorHandler'
import type { ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs'

export function useProfile(handle: string) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['profile', handle],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const profileService = getProfileService(agent)
      return profileService.getProfile(handle)
    },
    enabled: !!session && !!handle,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error.message.includes('ProfileNotFound')) return false
      return failureCount < 2
    }
  })
}

export function useAuthorFeed(handle: string) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['authorFeed', handle],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const profileService = getProfileService(agent)
      return profileService.getAuthorFeed(handle)
    },
    enabled: !!session && !!handle,
    staleTime: 60 * 1000, // 1 minute
  })
}

export function useFollowUser() {
  const { handleError } = useErrorHandler()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ profile }: { profile: ProfileViewDetailed }) => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const profileService = getProfileService(agent)
      
      if (profile.viewer?.following) {
        // Unfollow
        await profileService.unfollowUser(profile.viewer.following)
        return { followed: false }
      } else {
        // Follow
        const result = await profileService.followUser(profile.did)
        return { followed: true, uri: result.uri }
      }
    },
    onMutate: async ({ profile }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['profile', profile.handle] })
      
      // Get current data
      const previousProfile = queryClient.getQueryData<ProfileViewDetailed>(['profile', profile.handle])
      
      // Optimistically update
      if (previousProfile) {
        const isFollowing = !!previousProfile.viewer?.following
        queryClient.setQueryData(['profile', profile.handle], {
          ...previousProfile,
          followersCount: isFollowing 
            ? Math.max(0, (previousProfile.followersCount || 0) - 1)
            : (previousProfile.followersCount || 0) + 1,
          viewer: {
            ...previousProfile.viewer,
            following: isFollowing ? undefined : 'temp-uri'
          }
        })
      }
      
      return { previousProfile }
    },
    onError: (error, variables, context) => {
      // Revert on error
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', variables.profile.handle], context.previousProfile)
      }
      handleError(error)
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['profile', variables.profile.handle] })
    }
  })
}

export function useFollowers(handle: string, cursor?: string) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['followers', handle, cursor],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const profileService = getProfileService(agent)
      return profileService.getFollowers(handle, cursor)
    },
    enabled: !!session && !!handle,
    staleTime: 60 * 1000, // 1 minute
  })
}

export function useFollowing(handle: string, cursor?: string) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['following', handle, cursor],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const profileService = getProfileService(agent)
      return profileService.getFollows(handle, cursor)
    },
    enabled: !!session && !!handle,
    staleTime: 60 * 1000, // 1 minute
  })
}