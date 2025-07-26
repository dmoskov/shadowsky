/**
 * Component to display rate limiter statistics
 * Useful for debugging and monitoring API usage
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { getProfileService } from '../../services/atproto'
import { rateLimiters } from '../../services/atproto/rate-limiter'

interface RateLimiterStatsProps {
  className?: string
}

export const RateLimiterStats: React.FC<RateLimiterStatsProps> = ({ className }) => {
  const { agent } = useAuth()

  // Get profile service cache stats
  const { data: cacheStats } = useQuery({
    queryKey: ['rate-limiter-stats'],
    queryFn: async () => {
      if (!agent) return null
      
      const profileService = getProfileService(agent)
      const cache = profileService.getCacheStats()
      
      return {
        cache,
        rateLimiters: {
          profile: rateLimiters.profile.getQueueSize(),
          feed: rateLimiters.feed.getQueueSize(),
          general: rateLimiters.general.getQueueSize(),
        }
      }
    },
    enabled: !!agent,
    refetchInterval: 2000, // Update every 2 seconds
  })

  if (!cacheStats) return null

  return (
    <div className={`rate-limiter-stats ${className || ''}`}>
      <div style={{ 
        padding: '8px', 
        fontSize: '12px',
        backgroundColor: 'var(--bsky-bg-secondary)',
        borderRadius: '8px',
        fontFamily: 'monospace'
      }}>
        <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
          Rate Limiter Status
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div>Profile Queue: {cacheStats.rateLimiters.profile}</div>
          <div>Feed Queue: {cacheStats.rateLimiters.feed}</div>
          <div>General Queue: {cacheStats.rateLimiters.general}</div>
          <div>Cache Size: {cacheStats.cache.totalEntries}</div>
          <div>Valid Cache: {cacheStats.cache.validEntries}</div>
          <div>Expired: {cacheStats.cache.expiredEntries}</div>
        </div>
      </div>
    </div>
  )
}