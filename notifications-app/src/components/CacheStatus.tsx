import { useState, useEffect } from 'react'
import { NotificationCache } from '../utils/notificationCache'

export function CacheStatus() {
  const [cacheInfo, setCacheInfo] = useState(NotificationCache.getCacheInfo())
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Update cache info every 5 seconds when details are shown
    if (showDetails) {
      const interval = setInterval(() => {
        setCacheInfo(NotificationCache.getCacheInfo())
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [showDetails])

  const handleClearCache = (priority?: boolean) => {
    if (priority === undefined) {
      NotificationCache.clearAll()
    } else {
      NotificationCache.clear(priority)
    }
    setCacheInfo(NotificationCache.getCacheInfo())
    // Reload the page to refetch data
    window.location.reload()
  }

  const formatExpiry = (date: Date | null) => {
    if (!date) return 'No cache'
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const totalCached = cacheInfo.priorityCacheSize + cacheInfo.allCacheSize

  if (totalCached === 0 && !showDetails) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '60px',
      right: '20px',
      background: 'var(--bsky-bg-secondary)',
      border: '1px solid var(--bsky-border)',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      zIndex: 100,
      maxWidth: '300px'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💾</span>
          <span style={{ 
            color: 'var(--bsky-text-primary)', 
            fontSize: '14px',
            fontWeight: 500
          }}>
            {totalCached > 0 ? `${totalCached.toLocaleString()} cached` : 'No cache'}
          </span>
        </div>
        <span style={{ 
          color: 'var(--bsky-text-secondary)',
          fontSize: '12px'
        }}>
          {showDetails ? '▼' : '▶'}
        </span>
      </div>

      {showDetails && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--bsky-text-secondary)',
            marginBottom: '8px'
          }}>
            Cache persists for 24 hours to reduce API calls
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{ 
              padding: '8px',
              background: 'var(--bsky-bg-primary)',
              borderRadius: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--bsky-text-secondary)' }}>
                  Priority notifications
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  color: 'var(--bsky-primary)',
                  fontWeight: 500
                }}>
                  {formatExpiry(cacheInfo.priorityExpiry)}
                </span>
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'var(--bsky-text-primary)',
                marginTop: '2px'
              }}>
                {cacheInfo.priorityCacheSize.toLocaleString()} items
              </div>
            </div>

            <div style={{ 
              padding: '8px',
              background: 'var(--bsky-bg-primary)',
              borderRadius: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--bsky-text-secondary)' }}>
                  All notifications
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  color: 'var(--bsky-primary)',
                  fontWeight: 500
                }}>
                  {formatExpiry(cacheInfo.allExpiry)}
                </span>
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'var(--bsky-text-primary)',
                marginTop: '2px'
              }}>
                {cacheInfo.allCacheSize.toLocaleString()} items
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cacheInfo.hasPriorityCache && (
              <button
                onClick={() => handleClearCache(true)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--bsky-border)',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: 'var(--bsky-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bsky-bg-secondary)'
                  e.currentTarget.style.color = 'var(--bsky-text-primary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--bsky-text-secondary)'
                }}
              >
                Clear Priority
              </button>
            )}
            {cacheInfo.hasAllCache && (
              <button
                onClick={() => handleClearCache(false)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--bsky-border)',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: 'var(--bsky-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bsky-bg-secondary)'
                  e.currentTarget.style.color = 'var(--bsky-text-primary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--bsky-text-secondary)'
                }}
              >
                Clear All
              </button>
            )}
            {(cacheInfo.hasPriorityCache || cacheInfo.hasAllCache) && (
              <button
                onClick={() => handleClearCache()}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--bsky-border)',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: 'var(--bsky-error)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bsky-error)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--bsky-error)'
                }}
              >
                Clear Everything
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}