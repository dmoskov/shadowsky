import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  MoreHorizontal,
  Share,
  UserPlus,
  UserMinus,
  Image,
  MessageCircle,
  Heart
} from 'lucide-react'
import { format } from 'date-fns'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile, useAuthorFeed, useFollowUser } from '../../hooks/useProfile'
import { PostCard } from '../feed/PostCard'
import { ComposeModal } from '../modals/ComposeModal'
import { FollowersModal } from '../modals/FollowersModal'
import type { Post } from '@bsky/shared/types/atproto'

type TabType = 'posts' | 'replies' | 'media' | 'likes'

export const Profile: React.FC = () => {
  const { handle } = useParams<{ handle: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('posts')
  const [showMenu, setShowMenu] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Post | null>(null)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers')
  
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(handle || '')
  const { data: feedData, isLoading: feedLoading } = useAuthorFeed(handle || '')
  const { mutate: toggleFollow, isPending: isFollowPending } = useFollowUser()

  const handleBack = () => {
    navigate(-1)
  }

  const handleFollowToggle = () => {
    if (profile) {
      toggleFollow({ profile })
    }
  }

  const handleViewThread = (uri: string) => {
    console.log('Profile handleViewThread called with URI:', uri);
    const encodedUri = encodeURIComponent(uri);
    const path = `/thread/${encodedUri}`;
    console.log('Navigating to:', path);
    navigate(path);
    console.log('Navigation called');
  }

  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-gray-800 rounded-lg animate-pulse" />
            <div className="flex-1 mx-4">
              <div className="h-5 bg-gray-800 rounded w-32 animate-pulse mb-1" />
              <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
            </div>
            <div className="w-10 h-10 bg-gray-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg mx-4 mt-4">
          <div className="h-32 bg-gray-800 animate-pulse" />
          <div className="px-4 pb-4">
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className="w-20 h-20 bg-gray-800 rounded-full animate-pulse border-4 border-gray-900" />
              <div className="w-24 h-9 bg-gray-800 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-800 rounded w-48 animate-pulse" />
              <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
              <div className="h-16 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Profile not found</h2>
          <p className="text-gray-400 mb-4">The user @{handle} doesn't exist or has been deleted.</p>
          <button 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            onClick={handleBack}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const isFollowing = !!profile?.viewer?.following
  const isOwnProfile = session?.handle === handle

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.header 
        className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center justify-between">
          <motion.button
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={handleBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="flex-1 mx-4">
            <h1 className="text-xl font-semibold">{profile?.displayName || handle}</h1>
            <p className="text-sm text-gray-400">
              {profile?.postsCount || 0} posts
            </p>
          </div>

          <motion.button
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors relative"
            onClick={() => setShowMenu(!showMenu)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MoreHorizontal size={20} />
          </motion.button>
        </div>
      </motion.header>

      {/* Profile Info */}
      <motion.div 
        className="bg-gray-900 border border-gray-800 rounded-lg mx-4 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Banner */}
        {profile?.banner && (
          <div className="h-32 overflow-hidden rounded-t-lg">
            <img src={profile.banner} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Avatar and Actions */}
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="w-20 h-20 rounded-full border-4 border-gray-900 overflow-hidden bg-gray-800">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.handle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-400">
                  {handle?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isOwnProfile && (
                <motion.button
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isFollowing 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  onClick={handleFollowToggle}
                  disabled={isFollowPending}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus size={18} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Follow</span>
                    </>
                  )}
                </motion.button>
              )}
              
              <motion.button
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Share size={18} />
              </motion.button>
            </div>
          </div>

          {/* User Info */}
          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-bold">{profile?.displayName || handle}</h2>
              <p className="text-gray-400">@{handle}</p>
            </div>
            
            {profile?.description && (
              <p className="text-gray-200 whitespace-pre-wrap">{profile.description}</p>
            )}

            {/* Meta Info */}
            <div>
              {profile?.createdAt && (
                <span className="flex items-center gap-1 text-sm text-gray-400">
                  <Calendar size={16} />
                  Joined {format(new Date(profile.createdAt), 'MMMM yyyy')}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 pt-2">
              <button 
                className="hover:underline"
                onClick={() => {
                  setFollowersModalTab('followers')
                  setShowFollowersModal(true)
                }}
              >
                <span className="font-semibold">{profile?.followersCount || 0}</span>
                <span className="text-gray-400 ml-1">Followers</span>
              </button>
              <button 
                className="hover:underline"
                onClick={() => {
                  setFollowersModalTab('following')
                  setShowFollowersModal(true)
                }}
              >
                <span className="font-semibold">{profile?.followsCount || 0}</span>
                <span className="text-gray-400 ml-1">Following</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 mt-4 px-4">
        <button
          className={`flex-1 py-4 font-medium transition-colors border-b-2 ${
            activeTab === 'posts' 
              ? 'text-blue-400 border-blue-400' 
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={`flex-1 py-4 font-medium transition-colors border-b-2 flex items-center justify-center gap-1 ${
            activeTab === 'replies' 
              ? 'text-blue-400 border-blue-400' 
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('replies')}
        >
          <MessageCircle size={16} />
          Replies
        </button>
        <button
          className={`flex-1 py-4 font-medium transition-colors border-b-2 flex items-center justify-center gap-1 ${
            activeTab === 'media' 
              ? 'text-blue-400 border-blue-400' 
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('media')}
        >
          <Image size={16} />
          Media
        </button>
        <button
          className={`flex-1 py-4 font-medium transition-colors border-b-2 flex items-center justify-center gap-1 ${
            activeTab === 'likes' 
              ? 'text-blue-400 border-blue-400' 
              : 'text-gray-400 border-transparent hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('likes')}
        >
          <Heart size={16} />
          Likes
        </button>
      </div>

      {/* Posts Feed */}
      <div className="divide-y divide-gray-800">
        {feedLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedData?.posts && feedData.posts.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {feedData.posts.map((post, index) => (
              <motion.div
                key={post.uri}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <PostCard 
                  item={{ post, reply: undefined, reason: undefined }} 
                  onReply={setReplyingTo}
                  onViewThread={handleViewThread}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">No posts yet</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {replyingTo && (
        <ComposeModal
          isOpen={!!replyingTo}
          onClose={() => setReplyingTo(null)}
          replyTo={replyingTo ? { post: replyingTo } : undefined}
        />
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute right-4 top-20 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px] z-20"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button className="w-full px-4 py-2 hover:bg-gray-700 transition-colors flex items-center gap-3 text-left">
              <Share size={18} />
              <span>Share Profile</span>
            </button>
            <button className="w-full px-4 py-2 hover:bg-gray-700 transition-colors flex items-center gap-3 text-left">
              <LinkIcon size={18} />
              <span>Copy Link</span>
            </button>
            {!isOwnProfile && (
              <>
                <div className="border-t border-gray-700 my-1" />
                <button className="w-full px-4 py-2 hover:bg-gray-700 transition-colors text-red-400 text-left">
                  <span>Block User</span>
                </button>
                <button className="w-full px-4 py-2 hover:bg-gray-700 transition-colors text-red-400 text-left">
                  <span>Report User</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Followers Modal */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        handle={handle || ''}
        initialTab={followersModalTab}
      />
    </div>
  )
}