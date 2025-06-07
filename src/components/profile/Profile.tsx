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
import type { Post } from '../../types/atproto'

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
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-header-nav">
            <div className="skeleton skeleton-btn" />
            <div className="profile-header-info">
              <div className="skeleton skeleton-text" style={{ width: '150px' }} />
              <div className="skeleton skeleton-text" style={{ width: '80px' }} />
            </div>
            <div className="skeleton skeleton-btn" />
          </div>
        </div>
        <div className="profile-info card">
          <div className="skeleton skeleton-banner" />
          <div className="profile-main">
            <div className="skeleton skeleton-avatar large" />
            <div className="skeleton skeleton-btn" style={{ width: '100px' }} />
          </div>
          <div className="profile-details">
            <div className="skeleton skeleton-text" style={{ width: '200px' }} />
            <div className="skeleton skeleton-text" style={{ width: '150px' }} />
            <div className="skeleton skeleton-text" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="container">
        <div className="error-state">
          <h2>Profile not found</h2>
          <p>The user @{handle} doesn't exist or has been deleted.</p>
          <button className="btn btn-primary" onClick={handleBack}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const isFollowing = !!profile?.viewer?.following
  const isOwnProfile = session?.handle === handle

  return (
    <div className="profile-page">
      {/* Header */}
      <motion.header 
        className="profile-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="profile-header-nav">
          <motion.button
            className="btn btn-icon btn-ghost"
            onClick={handleBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <div className="profile-header-info">
            <h1 className="text-h3">{profile?.displayName || handle}</h1>
            <p className="text-caption text-secondary">
              {profile?.postsCount || 0} posts
            </p>
          </div>

          <motion.button
            className="btn btn-icon btn-ghost"
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
        className="profile-info card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Banner */}
        {profile?.banner && (
          <div className="profile-banner">
            <img src={profile.banner} alt="" />
          </div>
        )}

        {/* Avatar and Actions */}
        <div className="profile-main">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.handle} />
              ) : (
                <div className="avatar-placeholder large">
                  {handle?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="profile-actions">
            {!isOwnProfile && (
              <motion.button
                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
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
              className="btn btn-icon btn-secondary"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Share size={18} />
            </motion.button>
          </div>
        </div>

        {/* User Info */}
        <div className="profile-details">
          <h2 className="profile-display-name">{profile?.displayName || handle}</h2>
          <p className="profile-handle text-secondary">@{handle}</p>
          
          {profile?.description && (
            <p className="profile-bio">{profile.description}</p>
          )}

          {/* Meta Info */}
          <div className="profile-meta">
            {profile?.createdAt && (
              <span className="meta-item text-secondary">
                <Calendar size={16} />
                Joined {format(new Date(profile.createdAt), 'MMMM yyyy')}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <button 
              className="stat-item"
              onClick={() => {
                setFollowersModalTab('followers')
                setShowFollowersModal(true)
              }}
            >
              <span className="stat-value">{profile?.followersCount || 0}</span>
              <span className="stat-label text-secondary">Followers</span>
            </button>
            <button 
              className="stat-item"
              onClick={() => {
                setFollowersModalTab('following')
                setShowFollowersModal(true)
              }}
            >
              <span className="stat-value">{profile?.followsCount || 0}</span>
              <span className="stat-label text-secondary">Following</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={`tab-item ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={`tab-item ${activeTab === 'replies' ? 'active' : ''}`}
          onClick={() => setActiveTab('replies')}
        >
          <MessageCircle size={16} />
          Replies
        </button>
        <button
          className={`tab-item ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          <Image size={16} />
          Media
        </button>
        <button
          className={`tab-item ${activeTab === 'likes' ? 'active' : ''}`}
          onClick={() => setActiveTab('likes')}
        >
          <Heart size={16} />
          Likes
        </button>
      </div>

      {/* Posts Feed */}
      <div className="profile-feed">
        {feedLoading ? (
          <div className="loading-state">
            <div className="spinner" />
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
          <div className="empty-state">
            <p className="text-secondary">No posts yet</p>
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
            className="dropdown-menu profile-menu"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button className="dropdown-item">
              <Share size={18} />
              <span>Share Profile</span>
            </button>
            <button className="dropdown-item">
              <LinkIcon size={18} />
              <span>Copy Link</span>
            </button>
            {!isOwnProfile && (
              <>
                <div className="divider" />
                <button className="dropdown-item danger">
                  <span>Block User</span>
                </button>
                <button className="dropdown-item danger">
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