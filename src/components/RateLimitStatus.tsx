/**
 * Rate limit status indicator component
 * Shows current rate limit status and warnings
 */

import React, { useEffect, useState } from 'react'
import { rateLimiters, getGlobalRateLimiterStats } from '../services/atproto/rate-limiter'

interface RateLimitInfo {
  name: string
  queueSize: number
  isQueuing: boolean
}

interface GlobalStats {
  queueSize: number
  maxRequestsPerSecond: number
}

export function RateLimitStatus() {
  const [limitInfo, setLimitInfo] = useState<RateLimitInfo[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Update status every second
    const interval = setInterval(() => {
      const stats: RateLimitInfo[] = [
        {
          name: 'Profile',
          queueSize: rateLimiters.profile.getQueueSize(),
          isQueuing: rateLimiters.profile.getQueueSize() > 0
        },
        {
          name: 'Feed',
          queueSize: rateLimiters.feed.getQueueSize(),
          isQueuing: rateLimiters.feed.getQueueSize() > 0
        },
        {
          name: 'General',
          queueSize: rateLimiters.general.getQueueSize(),
          isQueuing: rateLimiters.general.getQueueSize() > 0
        }
      ]
      setLimitInfo(stats)
      setGlobalStats(getGlobalRateLimiterStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Check if any limits are being approached
  const hasWarnings = limitInfo.some(limit => limit.isQueuing) || (globalStats?.queueSize ?? 0) > 0
  
  if (!hasWarnings && !showDetails) {
    return null // Don't show anything if all is well
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: 'var(--surface-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '13px',
        maxWidth: '300px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1000
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: showDetails ? '8px' : 0
        }}
      >
        <span style={{ fontWeight: 500 }}>
          {hasWarnings ? '⚠️ Rate Limit Warning' : '✅ Rate Limits OK'}
        </span>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '12px'
          }}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>
      
      {showDetails && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ 
            marginBottom: '8px', 
            paddingBottom: '8px', 
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>
              Global Rate Limit: {globalStats?.maxRequestsPerSecond || 20} req/s
            </div>
            {globalStats && globalStats.queueSize > 0 && (
              <div style={{ color: 'var(--warning-color)', fontSize: '12px' }}>
                Global queue: {globalStats.queueSize} requests waiting
              </div>
            )}
          </div>
          
          {limitInfo.map((limit) => (
            <div 
              key={limit.name}
              style={{ 
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{limit.name}:</span>
              {limit.queueSize === 0 ? (
                <span style={{ color: 'var(--success-color)' }}>Ready</span>
              ) : (
                <span style={{ color: 'var(--warning-color)' }}>
                  {limit.queueSize} queued
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {hasWarnings && !showDetails && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Some API limits reached. Requests are being queued.
        </div>
      )}
    </div>
  )
}