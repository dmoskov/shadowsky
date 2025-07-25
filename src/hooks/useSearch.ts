import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getSearchService } from '@bsky/shared'
import { useDebounce } from './useDebounce'

export function useSearchActors(query: string) {
  const { session } = useAuth()
  const debouncedQuery = useDebounce(query, 300)

  return useQuery({
    queryKey: ['searchActors', debouncedQuery],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const searchService = getSearchService(agent)
      return searchService.searchActors(debouncedQuery)
    },
    enabled: !!session && debouncedQuery.length > 0,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useSearchPosts(query: string) {
  const { session } = useAuth()
  const debouncedQuery = useDebounce(query, 300)

  return useQuery({
    queryKey: ['searchPosts', debouncedQuery],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const searchService = getSearchService(agent)
      return searchService.searchPosts(debouncedQuery)
    },
    enabled: !!session && debouncedQuery.length > 0,
    staleTime: 60 * 1000 // 1 minute
  })
}

export function useSearchTypeahead(query: string) {
  const { session } = useAuth()
  const debouncedQuery = useDebounce(query, 150) // Faster debounce for typeahead

  return useQuery({
    queryKey: ['searchTypeahead', debouncedQuery],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const searchService = getSearchService(agent)
      return searchService.searchActorsTypeahead(debouncedQuery)
    },
    enabled: !!session && debouncedQuery.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  })
}