/**
 * Rate limit status indicator component
 * Shows current rate limit status and warnings
 */

import React, { useEffect, useState } from 'react'
import { getRateLimitStatus } from '@bsky/shared'

interface RateLimitInfo {
  available: boolean
  waitTime: number
}

interface RateLimitData {
  general: RateLimitInfo
  feed: RateLimitInfo
  interactions: RateLimitInfo
  search: RateLimitInfo
}

export function RateLimitStatus() {
  const [status, setStatus] = useState<RateLimitData | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Update status every second
    const interval = setInterval(() => {
      const currentStatus = getRateLimitStatus()
      setStatus(currentStatus)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!status) return null

  // Check if any limits are being approached
  const hasWarnings = Object.values(status).some(limit => !limit.available)
  
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
          {Object.entries(status).map(([key, limit]) => (
            <div 
              key={key}
              style={{ 
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>{key}:</span>
              {limit.available ? (
                <span style={{ color: 'var(--success-color)' }}>Available</span>
              ) : (
                <span style={{ color: 'var(--error-color)' }}>
                  Wait {Math.ceil(limit.waitTime / 1000)}s
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