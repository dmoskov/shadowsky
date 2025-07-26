import React, { useState } from 'react'
import { Database, Trash2, RefreshCw, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getProfileCacheService } from '../services/profile-cache-service'
import { getFollowerCacheDB } from '../services/follower-cache-db'

interface CacheSettingsProps {
  onClose?: () => void
}

export const CacheSettings: React.FC<CacheSettingsProps> = ({ onClose }) => {
  const { agent } = useAuth()
  const [cacheStats, setCacheStats] = useState<{
    totalProfiles: number
    totalInteractions: number
    staleProfiles: number
    cacheSize: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load cache stats
  React.useEffect(() => {
    if (agent) {
      loadCacheStats()
    }
  }, [agent])

  const loadCacheStats = async () => {
    if (!agent) return
    try {
      const cacheService = getProfileCacheService(agent)
      const stats = await cacheService.getCacheStats()
      setCacheStats(stats)
    } catch (error) {
      console.error('Error loading cache stats:', error)
    }
  }

  const handleClearCache = async () => {
    if (!agent || !confirm('Are you sure you want to clear the entire cache? This will remove all stored profile data.')) {
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const db = await getFollowerCacheDB()
      await db.clearCache()
      setMessage({ type: 'success', text: 'Cache cleared successfully' })
      await loadCacheStats()
    } catch (error) {
      console.error('Error clearing cache:', error)
      setMessage({ type: 'error', text: 'Failed to clear cache' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearStale = async () => {
    if (!agent) return

    setIsLoading(true)
    setMessage(null)

    try {
      const cacheService = getProfileCacheService(agent)
      const deletedCount = await cacheService.cleanupCache()
      setMessage({ 
        type: 'success', 
        text: `Removed ${deletedCount} stale profile${deletedCount !== 1 ? 's' : ''}` 
      })
      await loadCacheStats()
    } catch (error) {
      console.error('Error clearing stale profiles:', error)
      setMessage({ type: 'error', text: 'Failed to clear stale profiles' })
    } finally {
      setIsLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Database size={24} style={{ color: 'var(--bsky-primary)' }} />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
          Cache Settings
        </h2>
      </div>

      {cacheStats && (
        <div className="space-y-4 mb-6">
          <div className="bsky-card p-4">
            <h3 className="font-medium mb-3" style={{ color: 'var(--bsky-text-primary)' }}>
              Cache Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p style={{ color: 'var(--bsky-text-tertiary)' }}>Cached Profiles</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                  {cacheStats.totalProfiles.toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--bsky-text-tertiary)' }}>Interaction Records</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                  {cacheStats.totalInteractions.toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--bsky-text-tertiary)' }}>Stale Profiles</p>
                <p className="text-lg font-semibold" style={{ color: cacheStats.staleProfiles > 0 ? 'var(--bsky-warning)' : 'var(--bsky-text-primary)' }}>
                  {cacheStats.staleProfiles.toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--bsky-text-tertiary)' }}>Estimated Size</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                  {formatBytes(cacheStats.cacheSize)}
                </p>
              </div>
            </div>
          </div>

          <div className="bsky-card p-4" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
            <div className="flex items-start gap-2">
              <Info size={16} style={{ color: 'var(--bsky-primary)', marginTop: 2 }} />
              <div className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                <p className="mb-1">
                  Profile data is cached for 1 week to reduce API calls and improve performance.
                </p>
                <p>
                  Stale profiles are automatically refreshed when accessed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div 
          className={`p-3 rounded-lg mb-4 text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleClearStale}
          disabled={isLoading || !cacheStats || cacheStats.staleProfiles === 0}
          className="bsky-button-secondary w-full flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} />
          Clear Stale Profiles
          {cacheStats && cacheStats.staleProfiles > 0 && (
            <span className="bsky-badge ml-1">
              {cacheStats.staleProfiles}
            </span>
          )}
        </button>

        <button
          onClick={handleClearCache}
          disabled={isLoading}
          className="bsky-button-secondary w-full flex items-center justify-center gap-2"
          style={{ color: 'var(--bsky-error)' }}
        >
          <Trash2 size={16} />
          Clear Entire Cache
        </button>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="bsky-button-primary w-full mt-6"
        >
          Done
        </button>
      )}
    </div>
  )
}