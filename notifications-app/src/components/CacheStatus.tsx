import { useState, useEffect } from 'react'
import { NotificationCache } from '../utils/notificationCache'
import { PostCache } from '../utils/postCache'

export function CacheStatus() {
  const [cacheInfo, setCacheInfo] = useState(NotificationCache.getCacheInfo())
  const [postCacheInfo, setPostCacheInfo] = useState(PostCache.getCacheInfo())
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Update cache info every 5 seconds when details are shown
    if (showDetails) {
      const interval = setInterval(() => {
        setCacheInfo(NotificationCache.getCacheInfo())
        setPostCacheInfo(PostCache.getCacheInfo())
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [showDetails])

  const handleClearCache = (type: 'priority' | 'all' | 'posts' | 'everything') => {
    switch (type) {
      case 'priority':
        NotificationCache.clear(true)
        break
      case 'all':
        NotificationCache.clear(false)
        break
      case 'posts':
        PostCache.clear()
        break
      case 'everything':
        NotificationCache.clearAll()
        PostCache.clear()
        break
    }
    setCacheInfo(NotificationCache.getCacheInfo())
    setPostCacheInfo(PostCache.getCacheInfo())
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

  const totalNotifications = cacheInfo.priorityCacheSize + cacheInfo.allCacheSize
  const totalCached = totalNotifications + postCacheInfo.postCount

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
            Notifications: 24hr cache | Posts: 7-day cache
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

            {postCacheInfo.hasCache && (
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
                    Post content
                  </span>
                  <span style={{ 
                    fontSize: '11px', 
                    color: 'var(--bsky-primary)',
                    fontWeight: 500
                  }}>
                    {postCacheInfo.cacheAge} old
                  </span>
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: 'var(--bsky-text-primary)',
                  marginTop: '2px'
                }}>
                  {postCacheInfo.postCount.toLocaleString()} posts
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cacheInfo.hasPriorityCache && (
              <button
                onClick={() => handleClearCache('priority')}
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
                onClick={() => handleClearCache('all')}
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
                Clear All Notifs
              </button>
            )}
            {postCacheInfo.hasCache && (
              <button
                onClick={() => handleClearCache('posts')}
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
                Clear Posts
              </button>
            )}
            {(cacheInfo.hasPriorityCache || cacheInfo.hasAllCache || postCacheInfo.hasCache) && (
              <button
                onClick={() => handleClearCache('everything')}
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