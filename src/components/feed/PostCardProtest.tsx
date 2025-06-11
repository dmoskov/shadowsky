import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Repeat, Share, MoreHorizontal, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme, useProtestFeatures } from '../../contexts/ThemeContext'
import type { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs'
import { getPostText, formatPostTime } from '../../utils/post-helpers'

interface PostCardProtestProps {
  post: PostView
  onViewThread?: (uri: string) => void
  isThreadView?: boolean
  depth?: number
}

export const PostCardProtest: React.FC<PostCardProtestProps> = ({
  post,
  onViewThread,
  isThreadView = false,
  depth = 0
}) => {
  const navigate = useNavigate()
  const { isProtestTheme } = useTheme()
  const { solidarityReactions, useResistanceMode } = useProtestFeatures()
  const { isResistanceMode, resistanceClasses } = useResistanceMode()
  
  const [showSolidarityReactions, setShowSolidarityReactions] = useState(false)
  const [handprintVisible, setHandprintVisible] = useState(false)
  const [activeReaction, setActiveReaction] = useState<string | null>(null)

  const postText = getPostText(post) || ''
  const author = post?.author || { handle: 'unknown', displayName: 'Unknown' }
  const timestamp = post ? formatPostTime(post) : 'just now'
  const stats = {
    likeCount: post?.likeCount || 0,
    repostCount: post?.repostCount || 0,
    replyCount: post?.replyCount || 0
  }

  // Enhanced stats for protest theme
  const isViral = stats.likeCount > 100 || stats.repostCount > 50
  const isUrgent = postText.toLowerCase().includes('urgent') || 
                   postText.toLowerCase().includes('breaking') ||
                   postText.toLowerCase().includes('alert')

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && 
        (e.target.closest('button') || e.target.closest('a'))) {
      return
    }

    // Handprint effect on click
    setHandprintVisible(true)
    setTimeout(() => setHandprintVisible(false), 2000)

    if (onViewThread) {
      onViewThread(post.uri)
    }
  }

  const handleSolidarityReaction = (reaction: string) => {
    setActiveReaction(reaction)
    setShowSolidarityReactions(false)
    
    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
    
    setTimeout(() => setActiveReaction(null), 3000)
  }

  if (!isProtestTheme || !post) {
    return null // Fallback to regular PostCard
  }

  return (
    <motion.article
      className={`
        relative bg-protest-card torn-edge poster-shadow wheat-paste 
        border-2 border-orange-500/60 rounded-lg p-4 mb-4 cursor-pointer
        hover:shadow-lg transition-all duration-300 handprint-click
        ${isViral ? 'handprint-bg' : ''}
        ${isUrgent ? 'emergency-alert' : ''}
        ${resistanceClasses}
        ${depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : ''}
      `}
      initial={{ opacity: 0, y: 20, rotate: -1 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        rotate: Math.random() * 4 - 2 // Random rotation between -2 and 2 degrees
      }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      layout
      onClick={handleCardClick}
    >
      {/* Urgent Alert Banner */}
      {isUrgent && (
        <motion.div
          className="absolute -top-2 -left-2 -right-2 bg-red-600 text-white text-xs font-bold text-center py-1 uppercase tracking-wider"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ 
            background: 'repeating-linear-gradient(45deg, #dc143c, #dc143c 10px, #ffd700 10px, #ffd700 20px)'
          }}
        >
          ⚠️ URGENT BROADCAST ⚠️
        </motion.div>
      )}

      {/* Post Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative">
          <img
            src={author.avatar || '/default-avatar.png'}
            alt={author.handle}
            className={`w-12 h-12 rounded-full border-2 border-gray-800 ${
              isResistanceMode ? 'blur-sm hover:blur-none transition-all' : ''
            }`}
          />
          {/* Stencil effect overlay for avatars */}
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-red-500 opacity-20 pointer-events-none" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-gray-900 truncate stencil-text">
              {author.displayName || author.handle}
            </h3>
            <span className={`text-sm text-gray-600 ${isResistanceMode ? 'blur-sm hover:blur-none' : ''}`}>
              @{author.handle}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <time className="text-xs text-gray-600 font-mono bg-gray-800 text-white px-1 rounded">
              {timestamp}
            </time>
            {isViral && (
              <span className="resistance-badge">VIRAL</span>
            )}
          </div>
        </div>

        <button className="p-1 rounded hover:bg-gray-200 transition-colors">
          <MoreHorizontal size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-gray-900 leading-relaxed font-medium whitespace-pre-wrap">
          {postText}
        </p>
        
      </div>

      {/* Engagement Bar - Protest Style */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-dashed border-red-500/30">
        <div className="flex items-center gap-6">
          {/* Reply Button */}
          <motion.button
            className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle size={18} className="group-hover:animate-pulse" />
            <span className="text-sm font-bold">{stats.replyCount}</span>
          </motion.button>

          {/* Repost Button */}
          <motion.button
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Repeat size={18} className="group-hover:animate-spin" />
            <span className="text-sm font-bold">{stats.repostCount}</span>
          </motion.button>

          {/* Like Button */}
          <motion.button
            className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Heart size={18} className="group-hover:fill-current" />
            <span className="text-sm font-bold">{stats.likeCount}</span>
          </motion.button>

          {/* Solidarity Button - Protest Exclusive */}
          <motion.button
            className="flex items-center gap-1 text-gray-600 hover:text-yellow-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setShowSolidarityReactions(!showSolidarityReactions)
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap size={18} />
            <span className="text-xs font-bold uppercase">Solidarity</span>
          </motion.button>
        </div>

        {/* Share Button */}
        <motion.button
          className="text-gray-600 hover:text-gray-800 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Share size={18} />
        </motion.button>
      </div>

      {/* Solidarity Reactions Popup */}
      <AnimatePresence>
        {showSolidarityReactions && (
          <motion.div
            className="absolute bottom-16 left-4 bg-red-600 rounded-lg p-2 shadow-lg z-10"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
          >
            <div className="flex gap-2">
              {solidarityReactions.map((reaction) => (
                <motion.button
                  key={reaction}
                  className="w-8 h-8 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSolidarityReaction(reaction)
                  }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {reaction}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Reaction Display */}
      <AnimatePresence>
        {activeReaction && (
          <motion.div
            className="absolute top-4 right-4 text-2xl pointer-events-none"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            {activeReaction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handprint Click Effect */}
      <AnimatePresence>
        {handprintVisible && (
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl text-red-500 pointer-events-none"
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{ scale: 1, opacity: 0.6, rotate: 15 }}
            exit={{ scale: 1.5, opacity: 0, rotate: 30 }}
            transition={{ duration: 2 }}
          >
            ✋
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spray Paint Drip Effect */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-red-500 opacity-30 rounded-full" 
           style={{ background: 'linear-gradient(to bottom, #dc143c, transparent)' }} />
    </motion.article>
  )
}