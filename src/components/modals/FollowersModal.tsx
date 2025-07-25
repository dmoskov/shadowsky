import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, UserCheck } from 'lucide-react'
import { useFollowers, useFollowing } from '../../hooks/useProfile'
import { getBskyProfileUrl } from '../../utils/url-helpers'
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
  const [activeTab, setActiveTab] = useState(initialTab)
  
  const { data: followersData, isLoading: followersLoading } = useFollowers(handle)
  const { data: followingData, isLoading: followingLoading } = useFollowing(handle)

  const handleUserClick = (userHandle: string) => {
    window.open(getBskyProfileUrl(userHandle), '_blank', 'noopener,noreferrer')
    onClose()
  }

  const renderUserList = (users: ProfileView[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )
    }

    if (!users || users.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-400">
            {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </p>
        </div>
      )
    }

    return (
      <div className="divide-y divide-gray-800">
        {users.map((user) => (
          <motion.div
            key={user.did}
            className="flex items-start gap-3 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
            onClick={() => handleUserClick(user.handle)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.handle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-semibold">
                  {user.handle.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold truncate">
                  {user.displayName || user.handle}
                </span>
                <span className="text-gray-400 text-sm">@{user.handle}</span>
              </div>
              {user.description && (
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{user.description}</p>
              )}
            </div>
            {user.viewer?.following && (
              <div className="text-blue-400 flex-shrink-0">
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
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-gray-900 rounded-xl shadow-xl z-50 max-h-[80vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-xl font-semibold">
                {activeTab === 'followers' ? 'Followers' : 'Following'}
              </h2>
              <motion.button
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              <button
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'followers' 
                    ? 'text-blue-400 border-blue-400' 
                    : 'text-gray-400 border-transparent hover:text-gray-200'
                }`}
                onClick={() => setActiveTab('followers')}
              >
                <Users size={16} />
                Followers
                {followersData?.followers && (
                  <span className="ml-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs">{followersData.followers.length}</span>
                )}
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'following' 
                    ? 'text-blue-400 border-blue-400' 
                    : 'text-gray-400 border-transparent hover:text-gray-200'
                }`}
                onClick={() => setActiveTab('following')}
              >
                <UserCheck size={16} />
                Following
                {followingData?.follows && (
                  <span className="ml-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs">{followingData.follows.length}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
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