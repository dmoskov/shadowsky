import React, { useEffect, useState } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { getRateLimiterStats } from '../services/rate-limiter'

interface RateLimitBucket {
  name: string
  stats: {
    availableTokens: number
    maxTokens: number
    throttledRequests: number
    queueLength: number
  }
  color: string
}

export const RateLimitStatus: React.FC = () => {
  const [stats, setStats] = useState<RateLimitBucket[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Check for debug mode
  const urlParams = new URLSearchParams(window.location.search)
  const debugMode = urlParams.has('debug')
  
  // Don't render if not in debug mode
  if (!debugMode) {
    return null
  }

  useEffect(() => {
    const updateStats = () => {
      const limiterStats = getRateLimiterStats()
      setStats([
        { name: 'API', stats: limiterStats.api, color: 'var(--bsky-primary)' },
        { name: 'Profiles', stats: limiterStats.profile, color: 'var(--bsky-green)' },
        { name: 'Posts', stats: limiterStats.post, color: 'var(--bsky-blue)' },
        { name: 'Notifications', stats: limiterStats.notification, color: 'var(--bsky-purple)' }
      ])
    }

    updateStats()
    const interval = setInterval(updateStats, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])

  const hasThrottling = stats.some(s => s.stats.throttledRequests > 0 || s.stats.queueLength > 0)

  return (
    <div 
      className="fixed bottom-4 right-4 z-50"
      style={{ maxWidth: '300px' }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bsky-card p-3 flex items-center gap-2 hover:opacity-90 transition-opacity"
        style={{ 
          background: hasThrottling ? 'var(--bsky-red-subtle)' : 'var(--bsky-bg-secondary)',
          border: hasThrottling ? '1px solid var(--bsky-red)' : '1px solid var(--bsky-border)'
        }}
      >
        {hasThrottling ? (
          <AlertTriangle size={16} style={{ color: 'var(--bsky-red)' }} />
        ) : (
          <Shield size={16} style={{ color: 'var(--bsky-green)' }} />
        )}
        <span className="text-sm font-medium" style={{ 
          color: hasThrottling ? 'var(--bsky-red)' : 'var(--bsky-text-primary)' 
        }}>
          {hasThrottling ? 'Rate Limiting Active' : 'Rate Limits OK'}
        </span>
      </button>

      {isExpanded && (
        <div 
          className="bsky-card mt-2 p-4 shadow-lg"
          style={{ background: 'var(--bsky-bg-primary)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--bsky-text-primary)' }}>
            API Rate Limits
          </h3>
          
          <div className="space-y-3">
            {stats.map((bucket) => (
              <div key={bucket.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>
                    {bucket.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    {bucket.stats.availableTokens}/{bucket.stats.maxTokens} tokens
                  </span>
                </div>
                
                <div className="w-full h-2 rounded-full overflow-hidden" 
                     style={{ background: 'var(--bsky-bg-tertiary)' }}>
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${(bucket.stats.availableTokens / bucket.stats.maxTokens) * 100}%`,
                      background: bucket.color
                    }}
                  />
                </div>
                
                {(bucket.stats.throttledRequests > 0 || bucket.stats.queueLength > 0) && (
                  <div className="flex gap-3 mt-1">
                    {bucket.stats.throttledRequests > 0 && (
                      <span className="text-xs" style={{ color: 'var(--bsky-red)' }}>
                        {bucket.stats.throttledRequests} throttled
                      </span>
                    )}
                    {bucket.stats.queueLength > 0 && (
                      <span className="text-xs" style={{ color: 'var(--bsky-orange)' }}>
                        {bucket.stats.queueLength} queued
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-xs mt-3" style={{ color: 'var(--bsky-text-tertiary)' }}>
            Rate limiting ensures respectful API usage. The app will slow down rather than spam the API.
          </p>
        </div>
      )}
    </div>
  )
}