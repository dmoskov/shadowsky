import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getThreadService } from '../services/atproto/thread'
import { useErrorHandler } from './useErrorHandler'

interface UseThreadDataOptions {
  postUri: string
  retry?: number
  fetchRoot?: boolean  // Whether to fetch the root thread instead of just this post
}

export const useThreadData = ({ postUri, retry = 2, fetchRoot = true }: UseThreadDataOptions) => {
  const { handleError } = useErrorHandler()
  
  const { data: thread, isLoading, error } = useQuery({
    queryKey: ['thread', postUri, fetchRoot],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const threadService = getThreadService(agent)
      
      // By default, fetch the root thread to show full context
      if (fetchRoot) {
        return threadService.getRootThread(postUri)
      }
      return threadService.getThread(postUri)
    },
    retry
  })
  
  // Handle errors
  useEffect(() => {
    if (error) {
      handleError(error)
    }
  }, [error, handleError])
  
  return {
    thread,
    isLoading,
    error
  }
}