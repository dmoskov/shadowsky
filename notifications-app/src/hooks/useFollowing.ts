import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { debug } from '@bsky/shared'

export function useFollowing() {
  const { session } = useAuth()
  
  return useQuery({
    queryKey: ['following', session?.did],
    queryFn: async () => {
      if (!session?.did) throw new Error('No user DID')
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      // Fetch all follows (paginated)
      const follows = new Set<string>()
      let cursor: string | undefined
      
      try {
        do {
          const response = await agent.app.bsky.graph.getFollows({
            actor: session.did,
            limit: 100,
            cursor
          })
          
          response.data.follows.forEach(follow => {
            follows.add(follow.did)
          })
          
          cursor = response.data.cursor
        } while (cursor)
        
        debug.log(`Loaded ${follows.size} following accounts`)
        return follows
      } catch (error) {
        debug.error('Failed to fetch following list:', error)
        throw error
      }
    },
    enabled: !!session?.did,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false
  })
}