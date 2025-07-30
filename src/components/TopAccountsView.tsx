import React, { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Users, TrendingUp, Settings, Loader, Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getBskyProfileUrl } from '../utils/url-helpers'
import { getProfileCacheService } from '../services/profile-cache-service'
import { proxifyBskyImage } from '../utils/image-proxy'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { CachedProfile } from '../services/follower-cache-db'
import { debug } from '@bsky/shared'

interface TopAccountsViewProps {
  notifications: Notification[]
  minFollowerCount: number
  onConfigClick: () => void
}

interface AccountWithStats {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  followerCount?: number
  interactionCount: number
  latestInteraction: string
  lastFetched?: Date
  fromCache?: boolean
  interactions: {
    likes: number
    reposts: number
    follows: number
    replies: number
    mentions: number
    quotes: number
  }
}

export const TopAccountsView: React.FC<TopAccountsViewProps> = ({ 
  notifications, 
  minFollowerCount,
  onConfigClick 
}) => {
  const { agent } = useAuth()
  const [loadingProfiles, setLoadingProfiles] = useState(true)

  // Aggregate notifications by author
  const accountStats = useMemo(() => {
    const stats = new Map<string, AccountWithStats>()
    
    notifications.forEach(notification => {
      const did = notification.author.did
      
      if (!stats.has(did)) {
        stats.set(did, {
          did,
          handle: notification.author.handle,
          displayName: notification.author.displayName,
          avatar: notification.author.avatar,
          interactionCount: 0,
          latestInteraction: notification.indexedAt,
          interactions: {
            likes: 0,
            reposts: 0,
            follows: 0,
            replies: 0,
            mentions: 0,
            quotes: 0
          }
        })
      }
      
      const account = stats.get(did)!
      account.interactionCount++
      
      // Update latest interaction
      if (new Date(notification.indexedAt) > new Date(account.latestInteraction)) {
        account.latestInteraction = notification.indexedAt
      }
      
      // Count interaction types
      switch (notification.reason) {
        case 'like':
          account.interactions.likes++
          break
        case 'repost':
          account.interactions.reposts++
          break
        case 'follow':
          account.interactions.follows++
          break
        case 'reply':
          account.interactions.replies++
          break
        case 'mention':
          account.interactions.mentions++
          break
        case 'quote':
          account.interactions.quotes++
          break
      }
    })
    
    return Array.from(stats.values())
  }, [notifications])

  // Get unique account handles for batch profile fetching
  const uniqueHandles = useMemo(() => {
    return [...new Set(accountStats.map(acc => acc.handle))]
  }, [accountStats])

  // Update interaction stats in the database when notifications change
  useEffect(() => {
    if (agent && notifications.length > 0) {
      const cacheService = getProfileCacheService(agent)
      cacheService.updateInteractionStats(notifications).catch(console.error)
    }
  }, [agent, notifications])

  // Fetch profiles for all unique accounts using cache
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['cached-profiles', uniqueHandles],
    queryFn: async () => {
      if (!agent || uniqueHandles.length === 0) return new Map()
      
      setLoadingProfiles(true)
      
      try {
        // Use the cached profile service
        const cacheService = getProfileCacheService(agent)
        const profileMap = await cacheService.getProfilesWithCache(uniqueHandles)
        
        setLoadingProfiles(false)
        return profileMap
      } catch (error) {
        debug.error('Error fetching profiles:', error)
        setLoadingProfiles(false)
        return new Map<string, CachedProfile>()
      }
    },
    enabled: !!agent && uniqueHandles.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour (since we have our own cache)
  })
  
  // Query for cache statistics
  const { data: cacheStats } = useQuery({
    queryKey: ['cache-stats'],
    queryFn: async () => {
      if (!agent) return null
      const cacheService = getProfileCacheService(agent)
      return await cacheService.getCacheStats()
    },
    enabled: !!agent,
    refetchInterval: 10 * 1000, // Refresh every 10 seconds
  })

  // Enrich account stats with follower counts and filter
  const topAccounts = useMemo(() => {
    if (!profilesData) return []
    
    const enrichedAccounts = accountStats.map(account => {
      const profile = profilesData.get(account.handle)
      return {
        ...account,
        followerCount: profile?.followersCount || 0,
        lastFetched: profile?.lastFetched,
        fromCache: profile?.fromCache
      }
    })
    
    // Filter by minimum follower count and sort by follower count
    return enrichedAccounts
      .filter(account => account.followerCount >= minFollowerCount)
      .sort((a, b) => b.followerCount - a.followerCount)
  }, [accountStats, profilesData, minFollowerCount])

  if (!profilesData || loadingProfiles) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
            Top Accounts
          </h2>
          <button
            onClick={onConfigClick}
            className="bsky-button-secondary flex items-center gap-2"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
        
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bsky-card p-4 h-24 bsky-loading"></div>
          ))}
        </div>
      </div>
    )
  }

  if (topAccounts.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
            Top Accounts
          </h2>
          <button
            onClick={onConfigClick}
            className="bsky-button-secondary flex items-center gap-2"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
        
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-20">👥</div>
          <p className="text-lg mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
            No accounts with {minFollowerCount.toLocaleString()}+ followers
          </p>
          <p className="text-sm" style={{ color: 'var(--bsky-text-tertiary)' }}>
            Try lowering the follower threshold in settings
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
            Top Accounts
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--bsky-text-secondary)' }}>
              {topAccounts.length} accounts with {minFollowerCount.toLocaleString()}+ followers
            </span>
          </h2>
          {cacheStats && (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                <Database size={12} />
                <span>
                  Cache: {cacheStats.totalProfiles} profiles
                  {cacheStats.staleProfiles > 0 && ` (${cacheStats.staleProfiles} stale)`}
                </span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onConfigClick}
          className="bsky-button-secondary flex items-center gap-2"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      <div className="space-y-3">
        {topAccounts.map((account, index) => (
          <a
            key={account.did}
            href={getBskyProfileUrl(account.handle)}
            target="_blank"
            rel="noopener noreferrer"
            className="bsky-card p-4 block hover:opacity-90 transition-opacity no-underline"
          >
            <div className="flex items-start gap-4">
              {/* Rank badge */}
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ 
                  backgroundColor: index < 3 ? 'var(--bsky-primary)' : 'var(--bsky-bg-tertiary)',
                  color: index < 3 ? 'white' : 'var(--bsky-text-secondary)'
                }}
              >
                {index + 1}
              </div>

              {/* Avatar */}
              <div className="flex-shrink-0">
                {account.avatar ? (
                  <img 
                    src={proxifyBskyImage(account.avatar)} 
                    alt={account.handle}
                    className="w-12 h-12 bsky-avatar"
                  />
                ) : (
                  <div className="w-12 h-12 bsky-avatar flex items-center justify-center" 
                       style={{ background: 'var(--bsky-bg-tertiary)' }}>
                    <span className="text-lg font-semibold">
                      {account.handle.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Account info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate" style={{ color: 'var(--bsky-text-primary)' }}>
                    {account.displayName || account.handle}
                  </h3>
                  {index < 3 && <span title="Top 3">👑</span>}
                </div>
                
                <p className="text-sm mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                  @{account.handle}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                    <span style={{ color: 'var(--bsky-text-primary)' }}>
                      {account.followerCount.toLocaleString()}
                    </span>
                    <span style={{ color: 'var(--bsky-text-tertiary)' }}>followers</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                    <span style={{ color: 'var(--bsky-text-primary)' }}>
                      {account.interactionCount}
                    </span>
                    <span style={{ color: 'var(--bsky-text-tertiary)' }}>interactions</span>
                  </div>
                </div>

                {/* Interaction breakdown */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {account.interactions.likes > 0 && (
                    <span className="bsky-badge text-xs">
                      ❤️ {account.interactions.likes}
                    </span>
                  )}
                  {account.interactions.reposts > 0 && (
                    <span className="bsky-badge text-xs">
                      🔁 {account.interactions.reposts}
                    </span>
                  )}
                  {account.interactions.follows > 0 && (
                    <span className="bsky-badge text-xs">
                      ➕ {account.interactions.follows}
                    </span>
                  )}
                  {account.interactions.replies > 0 && (
                    <span className="bsky-badge text-xs">
                      💬 {account.interactions.replies}
                    </span>
                  )}
                  {account.interactions.mentions > 0 && (
                    <span className="bsky-badge text-xs">
                      @ {account.interactions.mentions}
                    </span>
                  )}
                  {account.interactions.quotes > 0 && (
                    <span className="bsky-badge text-xs">
                      " {account.interactions.quotes}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs mt-2" style={{ color: 'var(--bsky-text-tertiary)' }}>
                  <span>Last interaction {formatDistanceToNow(new Date(account.latestInteraction), { addSuffix: true })}</span>
                  {account.lastFetched && (
                    <>
                      <span>•</span>
                      <span 
                        title={`Profile data ${account.fromCache ? 'from cache' : 'freshly fetched'} ${formatDistanceToNow(new Date(account.lastFetched), { addSuffix: true })}`}
                        style={{ 
                          color: account.fromCache === false ? 'var(--bsky-green)' : 'inherit'
                        }}
                      >
                        {account.fromCache === false ? '🔄 API' : '💾 Cache'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}