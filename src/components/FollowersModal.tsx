import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFollowers, useFollowing } from '../hooks/useProfile'
import type { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs'

interface FollowersModalProps {
  isOpen: boolean
  onClose: () => void
  handle: string
  initialTab: 'followers' | 'following'
}

export const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  onClose,
  handle,
  initialTab
}) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(initialTab)
  
  const { data: followersData, isLoading: followersLoading } = useFollowers(handle)
  const { data: followingData, isLoading: followingLoading } = useFollowing(handle)

  const handleUserClick = (userHandle: string) => {
    navigate(`/profile/${userHandle}`)
    onClose()
  }

  const renderUserList = (users: ProfileView[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner" />
        </div>
      )
    }

    if (!users || users.length === 0) {
      return (
        <div className="empty-state">
          <p className="text-secondary">
            {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </p>
        </div>
      )
    }

    return (
      <div className="users-list">
        {users.map((user) => (
          <motion.div
            key={user.did}
            className="user-item"
            onClick={() => handleUserClick(user.handle)}
            whileHover={{ backgroundColor: 'var(--color-hover)' }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="user-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.handle} />
              ) : (
                <div className="avatar-placeholder">
                  {user.handle.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-info">
              <div className="user-names">
                <span className="user-display-name">
                  {user.displayName || user.handle}
                </span>
                <span className="user-handle text-secondary">@{user.handle}</span>
              </div>
              {user.description && (
                <p className="user-bio text-secondary">{user.description}</p>
              )}
            </div>
            {user.viewer?.following && (
              <div className="user-badge">
                <UserCheck size={16} />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="modal modal-followers"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">
                {activeTab === 'followers' ? 'Followers' : 'Following'}
              </h2>
              <motion.button
                className="btn btn-icon btn-ghost"
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="modal-tabs">
              <button
                className={`tab-item ${activeTab === 'followers' ? 'active' : ''}`}
                onClick={() => setActiveTab('followers')}
              >
                <Users size={16} />
                Followers
                {followersData?.followers && (
                  <span className="tab-count">{followersData.followers.length}</span>
                )}
              </button>
              <button
                className={`tab-item ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => setActiveTab('following')}
              >
                <UserCheck size={16} />
                Following
                {followingData?.follows && (
                  <span className="tab-count">{followingData.follows.length}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="modal-body">
              {activeTab === 'followers'
                ? renderUserList(followersData?.followers, followersLoading)
                : renderUserList(followingData?.follows, followingLoading)
              }
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}