import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AnalyticsSyncService } from '../services/analytics-sync'
import { getAnalyticsDB } from '../services/analytics-db'

export interface SyncStatus {
  isSyncing: boolean
  lastSync: Date | null
  progress: number
  message: string
  error: string | null
  stats: {
    totalPosts: number
    oldestPost: Date | null
    newestPost: Date | null
  } | null
}

export function useAnalyticsSync() {
  const { client, session } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    progress: 0,
    message: '',
    error: null,
    stats: null
  })

  // Load initial stats
  useEffect(() => {
    if (!session?.did) return

    const loadStats = async () => {
      try {
        const db = await getAnalyticsDB()
        const user = await db.getUser(session.did)
        const stats = await db.getStats(session.did)
        
        setSyncStatus(prev => ({
          ...prev,
          lastSync: user?.lastSync || null,
          stats: {
            totalPosts: stats.totalPosts,
            oldestPost: stats.oldestPost,
            newestPost: stats.newestPost
          }
        }))
      } catch (error) {
        console.error('Failed to load analytics stats:', error)
      }
    }

    loadStats()
  }, [session?.did])

  const syncAnalytics = useCallback(async (options?: { fullSync?: boolean }) => {
    if (!client || !session?.handle) {
      setSyncStatus(prev => ({
        ...prev,
        error: 'Not authenticated'
      }))
      return
    }

    setSyncStatus(prev => ({
      ...prev,
      isSyncing: true,
      progress: 0,
      message: 'Starting sync...',
      error: null
    }))

    try {
      const agent = (client as any).agent || (client as any)._agent
      if (!agent) throw new Error('No agent available')

      const syncService = new AnalyticsSyncService(agent)
      
      await syncService.syncUserData(session.handle, {
        fullSync: options?.fullSync,
        onProgress: (message, percent) => {
          setSyncStatus(prev => ({
            ...prev,
            progress: percent,
            message
          }))
        }
      })

      // Reload stats after sync
      const db = await getAnalyticsDB()
      const user = await db.getUser(session.did)
      const stats = await db.getStats(session.did)

      setSyncStatus({
        isSyncing: false,
        lastSync: user?.lastSync || new Date(),
        progress: 100,
        message: 'Sync complete!',
        error: null,
        stats: {
          totalPosts: stats.totalPosts,
          oldestPost: stats.oldestPost,
          newestPost: stats.newestPost
        }
      })
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        progress: 0
      }))
    }
  }, [client, session])

  // Auto-sync on first load if no data
  useEffect(() => {
    if (!syncStatus.stats || (syncStatus.stats.totalPosts === 0 && !syncStatus.lastSync)) {
      const timer = setTimeout(() => {
        if (!syncStatus.isSyncing && session?.handle) {
          syncAnalytics({ fullSync: true })
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [syncStatus.stats, syncStatus.lastSync, syncStatus.isSyncing, session?.handle, syncAnalytics])

  // Background sync every 30 minutes
  useEffect(() => {
    if (!session?.handle) return

    const interval = setInterval(() => {
      if (!syncStatus.isSyncing) {
        syncAnalytics({ fullSync: false })
      }
    }, 30 * 60 * 1000) // 30 minutes

    return () => clearInterval(interval)
  }, [session?.handle, syncStatus.isSyncing, syncAnalytics])

  return {
    syncStatus,
    syncAnalytics,
    isFirstSync: !syncStatus.lastSync && (!syncStatus.stats || syncStatus.stats.totalPosts === 0)
  }
}