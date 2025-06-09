import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Check, AlertCircle, Database, Clock } from 'lucide-react'
import { formatRelativeTime } from '../../utils/format-helpers'
import type { SyncStatus } from '../../hooks/useAnalyticsSync'

interface Props {
  syncStatus: SyncStatus
  onSync: (options?: { fullSync?: boolean }) => void
  isFirstSync: boolean
}

export const AnalyticsSyncStatus: React.FC<Props> = ({ syncStatus, onSync, isFirstSync }) => {
  const { isSyncing, lastSync, progress, message, error, stats } = syncStatus

  if (isFirstSync && !isSyncing) {
    return (
      <motion.div 
        className="analytics-first-sync"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="first-sync-content">
          <Database size={48} className="first-sync-icon" />
          <h2>Welcome to Analytics!</h2>
          <p>We need to fetch your Bluesky data to build your analytics dashboard.</p>
          <p className="first-sync-note">This first sync will fetch all your posts and may take a few minutes.</p>
          <button 
            onClick={() => onSync({ fullSync: true })}
            className="btn btn-primary btn-lg"
          >
            <Database size={20} />
            Start Initial Sync
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="analytics-sync-status">
      <AnimatePresence mode="wait">
        {isSyncing ? (
          <motion.div
            key="syncing"
            className="sync-progress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="sync-progress-header">
              <RefreshCw size={16} className="spinning" />
              <span>{message}</span>
            </div>
            <div className="sync-progress-bar">
              <motion.div 
                className="sync-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            className="sync-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => onSync()} className="btn-text">
              Retry
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="status"
            className="sync-info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="sync-stats">
              {stats && (
                <>
                  <div className="sync-stat">
                    <Database size={14} />
                    <span>{stats.totalPosts} posts stored</span>
                  </div>
                  {stats.oldestPost && (
                    <div className="sync-stat">
                      <Clock size={14} />
                      <span>Since {new Date(stats.oldestPost).toLocaleDateString()}</span>
                    </div>
                  )}
                </>
              )}
              {lastSync && (
                <div className="sync-stat">
                  <Check size={14} className="sync-success" />
                  <span>Updated {formatRelativeTime(lastSync)}</span>
                </div>
              )}
            </div>
            
            <div className="sync-actions">
              <button 
                onClick={() => onSync()}
                className="btn-icon"
                title="Sync recent data"
              >
                <RefreshCw size={16} />
              </button>
              <button 
                onClick={() => onSync({ fullSync: true })}
                className="btn-text"
                title="Full resync"
              >
                Full Sync
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}