import React, { useState, useEffect } from 'react'
import { HardDrive, Database, Package, AlertCircle, CheckCircle, Trash2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { NotificationCache } from '../utils/notificationCache'
import { NotificationObjectCache } from '../utils/notificationObjectCache'
import { PostCache } from '../utils/postCache'
import { StorageManager } from '../utils/storageManager'
import { NotificationCacheService } from '../services/notification-cache-service'
import { PostCacheService } from '../services/post-cache-service'

interface StorageBreakdown {
  key: string
  label: string
  size: number
  count?: number
  percentage?: number
  color: string
}

export function DebugConsole() {
  const [cacheInfo, setCacheInfo] = useState(NotificationCache.getCacheInfo())
  const [notificationObjectCacheInfo, setNotificationObjectCacheInfo] = useState(NotificationObjectCache.getCacheInfo())
  const [postCacheInfo, setPostCacheInfo] = useState(PostCache.getCacheInfo())
  const [storageMetrics, setStorageMetrics] = useState<ReturnType<typeof StorageManager.getStorageMetrics> | null>(null)
  const [storageHealth, setStorageHealth] = useState<ReturnType<typeof StorageManager.getStorageHealth> | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'cache' | 'storage'>('cache')
  const [indexedDBStats, setIndexedDBStats] = useState<any>(null)
  const [indexedDBReady, setIndexedDBReady] = useState(false)
  const [postIndexedDBStats, setPostIndexedDBStats] = useState<any>(null)
  const [postIndexedDBReady, setPostIndexedDBReady] = useState(false)
  
  // Check for debug mode
  const urlParams = new URLSearchParams(window.location.search)
  const debugMode = urlParams.has('debug')

  const updateMetrics = async () => {
    setCacheInfo(NotificationCache.getCacheInfo())
    setNotificationObjectCacheInfo(NotificationObjectCache.getCacheInfo())
    setPostCacheInfo(PostCache.getCacheInfo())
    setStorageMetrics(StorageManager.getStorageMetrics())
    setStorageHealth(StorageManager.getStorageHealth())
    
    // Get IndexedDB stats if available
    if (indexedDBReady) {
      try {
        const cacheService = NotificationCacheService.getInstance()
        const stats = await cacheService.getCacheStats()
        setIndexedDBStats(stats)
      } catch (error) {
        console.error('Failed to get IndexedDB stats:', error)
      }
    }
    
    // Get Post IndexedDB stats if available
    if (postIndexedDBReady) {
      try {
        const postStats = await PostCache.getIndexedDBCacheInfo()
        setPostIndexedDBStats(postStats)
      } catch (error) {
        console.error('Failed to get Post IndexedDB stats:', error)
      }
    }
  }

  useEffect(() => {
    // Initialize IndexedDB
    const initIndexedDB = async () => {
      try {
        const cacheService = NotificationCacheService.getInstance()
        await cacheService.init()
        setIndexedDBReady(true)
        
        // Also initialize Post IndexedDB
        const postCacheService = PostCacheService.getInstance()
        await postCacheService.init()
        setPostIndexedDBReady(true)
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error)
      }
    }
    initIndexedDB()
  }, [])

  useEffect(() => {
    updateMetrics()
    
    // Update metrics every 5 seconds when details are shown
    if (showDetails) {
      const interval = setInterval(updateMetrics, 5000)
      return () => clearInterval(interval)
    }
  }, [showDetails, indexedDBReady, postIndexedDBReady])

  const handleClearCache = (type: 'priority' | 'all' | 'posts' | 'notifications' | 'everything') => {
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
      case 'notifications':
        NotificationObjectCache.clear()
        break
      case 'everything':
        NotificationCache.clearAll()
        NotificationObjectCache.clear()
        PostCache.clear()
        break
    }
    updateMetrics()
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

  const getStorageBreakdown = (): StorageBreakdown[] => {
    if (!storageMetrics) return []
    
    const breakdown: StorageBreakdown[] = []
    const totalSize = storageMetrics.totalSize
    
    // Analyze storage by type
    storageMetrics.largestItems.forEach(item => {
      let category: StorageBreakdown | undefined
      let color = 'var(--bsky-primary)'
      
      if (item.key.includes('notifications_cache')) {
        category = breakdown.find(b => b.key === 'notifications')
        if (!category) {
          category = { key: 'notifications', label: 'Notifications Cache', size: 0, count: 0, color: '#3b82f6' }
          breakdown.push(category)
        }
      } else if (item.key.includes('notification_objects')) {
        category = breakdown.find(b => b.key === 'notification_objects')
        if (!category) {
          category = { key: 'notification_objects', label: 'Notification Objects', size: 0, count: 0, color: '#06b6d4' }
          breakdown.push(category)
        }
      } else if (item.key.includes('posts_cache')) {
        category = breakdown.find(b => b.key === 'posts')
        if (!category) {
          category = { key: 'posts', label: 'Posts Cache', size: 0, count: 0, color: '#8b5cf6' }
          breakdown.push(category)
        }
      } else if (item.key.includes('bsky_auth') || item.key.includes('session')) {
        category = breakdown.find(b => b.key === 'auth')
        if (!category) {
          category = { key: 'auth', label: 'Auth & Session', size: 0, count: 0, color: '#10b981' }
          breakdown.push(category)
        }
      } else if (item.key.includes('following')) {
        category = breakdown.find(b => b.key === 'following')
        if (!category) {
          category = { key: 'following', label: 'Following List', size: 0, count: 0, color: '#f59e0b' }
          breakdown.push(category)
        }
      } else {
        category = breakdown.find(b => b.key === 'other')
        if (!category) {
          category = { key: 'other', label: 'Other Data', size: 0, count: 0, color: '#6b7280' }
          breakdown.push(category)
        }
      }
      
      if (category) {
        category.size += item.size
        category.count = (category.count || 0) + 1
      }
    })
    
    // Calculate percentages
    breakdown.forEach(item => {
      item.percentage = (item.size / totalSize) * 100
    })
    
    // Sort by size
    return breakdown.sort((a, b) => b.size - a.size)
  }

  const getHealthIcon = () => {
    if (!storageHealth) return null
    switch (storageHealth.status) {
      case 'critical': return <AlertCircle className="text-red-500" size={16} />
      case 'warning': return <AlertCircle className="text-yellow-500" size={16} />
      default: return <CheckCircle className="text-green-500" size={16} />
    }
  }

  const getHealthColor = () => {
    if (!storageHealth) return 'var(--bsky-text-primary)'
    switch (storageHealth.status) {
      case 'critical': return 'var(--bsky-error)'
      case 'warning': return '#f59e0b'
      default: return 'var(--bsky-success)'
    }
  }

  // Only show if debug mode is enabled
  if (!debugMode) {
    return null
  }

  const totalNotifications = cacheInfo.priorityCacheSize + cacheInfo.allCacheSize
  const totalCached = totalNotifications + postCacheInfo.postCount + notificationObjectCacheInfo.notificationCount

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'var(--bsky-bg-secondary)',
      border: '1px solid var(--bsky-border)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 100,
      maxWidth: '400px',
      minWidth: '320px'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: showDetails ? '12px' : 0
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={20} style={{ color: 'var(--bsky-primary)' }} />
          <span style={{ 
            color: 'var(--bsky-text-primary)', 
            fontSize: '16px',
            fontWeight: 600
          }}>
            Debug Console {indexedDBReady && '(IndexedDB)'}
          </span>
          {storageHealth && getHealthIcon()}
        </div>
        {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {showDetails && (
        <>
          {/* Tab selector */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            borderBottom: '1px solid var(--bsky-border)',
            paddingBottom: '8px'
          }}>
            <button
              onClick={() => setActiveTab('cache')}
              style={{
                padding: '4px 12px',
                fontSize: '14px',
                border: 'none',
                background: activeTab === 'cache' ? 'var(--bsky-primary)' : 'transparent',
                color: activeTab === 'cache' ? 'white' : 'var(--bsky-text-secondary)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cache Status
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              style={{
                padding: '4px 12px',
                fontSize: '14px',
                border: 'none',
                background: activeTab === 'storage' ? 'var(--bsky-primary)' : 'transparent',
                color: activeTab === 'storage' ? 'white' : 'var(--bsky-text-secondary)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Storage Analytics
            </button>
          </div>

          {/* Cache Tab */}
          {activeTab === 'cache' && (
            <div>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--bsky-text-secondary)',
                marginBottom: '12px'
              }}>
                Total cached: {totalCached.toLocaleString()} items
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

                {notificationObjectCacheInfo.hasCache && (
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
                        Notification objects
                      </span>
                      <span style={{ 
                        fontSize: '11px', 
                        color: 'var(--bsky-primary)',
                        fontWeight: 500
                      }}>
                        {notificationObjectCacheInfo.cacheAge} old
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--bsky-text-primary)',
                      marginTop: '2px'
                    }}>
                      {notificationObjectCacheInfo.notificationCount.toLocaleString()} notifications
                    </div>
                  </div>
                )}

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
                        Post content (localStorage)
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

                {indexedDBStats && (
                  <div style={{ 
                    padding: '8px',
                    background: 'var(--bsky-bg-primary)',
                    borderRadius: '4px',
                    border: '1px solid var(--bsky-success)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--bsky-text-secondary)' }}>
                        IndexedDB Storage
                      </span>
                      <Database size={14} style={{ color: 'var(--bsky-success)' }} />
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--bsky-text-primary)',
                      marginTop: '2px'
                    }}>
                      {indexedDBStats.totalNotifications.toLocaleString()} notifications
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--bsky-text-secondary)',
                      marginTop: '2px'
                    }}>
                      {indexedDBStats.unreadCount} unread • {
                        indexedDBStats.oldestNotification && indexedDBStats.newestNotification
                          ? `${Math.floor((indexedDBStats.newestNotification.getTime() - indexedDBStats.oldestNotification.getTime()) / (1000 * 60 * 60 * 24))} days`
                          : 'No data'
                      }
                    </div>
                  </div>
                )}
                
                {postIndexedDBStats && postIndexedDBStats.hasCache && (
                  <div style={{ 
                    padding: '8px',
                    background: 'var(--bsky-bg-primary)',
                    borderRadius: '4px',
                    border: '1px solid var(--bsky-success)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--bsky-text-secondary)' }}>
                        Post IndexedDB Storage
                      </span>
                      <Package size={14} style={{ color: 'var(--bsky-success)' }} />
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--bsky-text-primary)',
                      marginTop: '2px'
                    }}>
                      {postIndexedDBStats.postCount.toLocaleString()} posts
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--bsky-text-secondary)',
                      marginTop: '2px'
                    }}>
                      {postIndexedDBStats.lastUpdate
                        ? `Updated ${Math.floor((Date.now() - postIndexedDBStats.lastUpdate.getTime()) / (1000 * 60 * 60))}h ago`
                        : 'No data'
                      }
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleClearCache('everything')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid var(--bsky-error)',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: 'var(--bsky-error)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={14} />
                  Clear All Caches
                </button>
              </div>
            </div>
          )}

          {/* Storage Tab */}
          {activeTab === 'storage' && storageMetrics && storageHealth && (
            <div>
              {/* Storage Health Status */}
              <div style={{
                padding: '8px',
                background: 'var(--bsky-bg-primary)',
                borderRadius: '4px',
                marginBottom: '12px',
                border: `1px solid ${getHealthColor()}20`
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <HardDrive size={16} style={{ color: getHealthColor() }} />
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: 500,
                    color: getHealthColor()
                  }}>
                    {storageHealth.message}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--bsky-text-secondary)' }}>
                  {StorageManager.formatBytes(storageMetrics.totalSize)} / ~5MB ({storageMetrics.usagePercentage.toFixed(1)}% used)
                </div>
              </div>

              {/* Storage Usage Bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  width: '100%',
                  height: '20px',
                  background: 'var(--bsky-bg-tertiary)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: getHealthColor(),
                    width: `${Math.min(storageMetrics.usagePercentage, 100)}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* IndexedDB Stats */}
              {indexedDBStats && (
                <div style={{
                  padding: '8px',
                  background: 'var(--bsky-bg-primary)',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  border: '1px solid var(--bsky-success)20'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <Database size={16} style={{ color: 'var(--bsky-success)' }} />
                    <span style={{ 
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--bsky-text-primary)'
                    }}>
                      IndexedDB Storage
                    </span>
                  </div>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '11px'
                  }}>
                    <div>
                      <span style={{ color: 'var(--bsky-text-tertiary)' }}>Total Notifications:</span>
                      <span style={{ color: 'var(--bsky-text-primary)', marginLeft: '4px' }}>
                        {indexedDBStats.totalNotifications.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--bsky-text-tertiary)' }}>Unread:</span>
                      <span style={{ color: 'var(--bsky-text-primary)', marginLeft: '4px' }}>
                        {indexedDBStats.unreadCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {Object.entries(indexedDBStats.reasonCounts).length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ 
                        fontSize: '11px',
                        color: 'var(--bsky-text-tertiary)'
                      }}>
                        By Type:
                      </span>
                      <div style={{ 
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '4px'
                      }}>
                        {Object.entries(indexedDBStats.reasonCounts).map(([reason, count]) => (
                          <span key={reason} style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--bsky-bg-secondary)',
                            color: 'var(--bsky-text-secondary)'
                          }}>
                            {reason}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Storage Breakdown */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: 'var(--bsky-text-secondary)'
                }}>
                  LocalStorage Breakdown:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {getStorageBreakdown().map(item => (
                    <div key={item.key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 8px',
                      background: 'var(--bsky-bg-primary)',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: item.color,
                        flexShrink: 0
                      }} />
                      <span style={{ 
                        flex: 1,
                        color: 'var(--bsky-text-primary)'
                      }}>
                        {item.label}
                      </span>
                      <span style={{ 
                        color: 'var(--bsky-text-secondary)',
                        fontSize: '11px'
                      }}>
                        {item.count} items
                      </span>
                      <span style={{ 
                        fontWeight: 500,
                        color: 'var(--bsky-text-primary)'
                      }}>
                        {StorageManager.formatBytes(item.size)}
                      </span>
                      <span style={{ 
                        color: 'var(--bsky-text-tertiary)',
                        fontSize: '11px'
                      }}>
                        {item.percentage?.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Largest Items */}
              {storageMetrics.largestItems.length > 0 && (
                <details style={{ marginBottom: '12px' }}>
                  <summary style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--bsky-text-secondary)',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}>
                    Largest Items ({storageMetrics.largestItems.length})
                  </summary>
                  <div style={{ 
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    {storageMetrics.largestItems.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '2px 4px',
                        background: idx % 2 === 0 ? 'var(--bsky-bg-primary)' : 'transparent',
                        borderRadius: '2px'
                      }}>
                        <span style={{ 
                          color: 'var(--bsky-text-tertiary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          marginRight: '8px'
                        }}>
                          {item.key}
                        </span>
                        <span style={{ color: 'var(--bsky-text-secondary)' }}>
                          {StorageManager.formatBytes(item.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Recommendations */}
              {storageHealth.recommendations.length > 0 && (
                <div style={{
                  padding: '8px',
                  background: 'var(--bsky-bg-primary)',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  border: `1px solid ${getHealthColor()}20`
                }}>
                  <div style={{ 
                    fontSize: '12px',
                    fontWeight: 500,
                    marginBottom: '4px',
                    color: 'var(--bsky-text-secondary)'
                  }}>
                    Recommendations:
                  </div>
                  <ul style={{ 
                    margin: 0,
                    paddingLeft: '16px',
                    fontSize: '11px',
                    color: 'var(--bsky-text-secondary)'
                  }}>
                    {storageHealth.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    StorageManager.cleanupStorage(7)
                    updateMetrics()
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid var(--bsky-border)',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: 'var(--bsky-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={14} />
                  Clean Old Data
                </button>
                <button
                  onClick={updateMetrics}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid var(--bsky-border)',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: 'var(--bsky-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}