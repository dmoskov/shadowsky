import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Share,
  MoreHorizontal,
  Bookmark,
  Link,
} from 'lucide-react'
import clsx from 'clsx'
import type { FeedItem } from '../types/atproto'

interface PostCardProps {
  item: FeedItem
}

export const PostCard: React.FC<PostCardProps> = ({ item }) => {
  const { post } = item
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likeCount || 0)
  const [reposted, setReposted] = useState(false)
  const [repostCount, setRepostCount] = useState(post.repostCount || 0)
  const [showMenu, setShowMenu] = useState(false)

  // Extract post text - Bluesky stores text directly in record.text
  const getPostText = (): string => {
    if (post.record && typeof post.record === 'object' && 'text' in post.record) {
      return (post.record as { text?: string }).text || ''
    }
    return ''
  }

  // Get post date
  const getPostDate = (): string => {
    // Check record.createdAt first
    if (post.record && typeof post.record === 'object' && 'createdAt' in post.record) {
      return (post.record as { createdAt?: string }).createdAt || post.indexedAt
    }
    return post.indexedAt || new Date().toISOString()
  }

  const handleLike = () => {
    if (liked) {
      setLiked(false)
      setLikeCount(count => Math.max(0, count - 1))
    } else {
      setLiked(true)
      setLikeCount(count => count + 1)
    }
  }

  const handleRepost = () => {
    if (reposted) {
      setReposted(false)
      setRepostCount(count => Math.max(0, count - 1))
    } else {
      setReposted(true)
      setRepostCount(count => count + 1)
    }
  }

  const postText = getPostText()
  const postDate = getPostDate()

  return (
    <motion.article
      className="post-card card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <div className="post-card-body">
        {/* Author Section */}
        <div className="post-author">
          <div className="post-author-avatar">
            {post.author.avatar ? (
              <img 
                src={post.author.avatar} 
                alt={post.author.handle}
                className="avatar-image"
              />
            ) : (
              <div className="avatar-placeholder">
                {post.author.handle.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="post-author-info">
            <div className="post-author-name">
              <span className="author-display-name">
                {post.author.displayName || post.author.handle}
              </span>
              {post.author.displayName && (
                <span className="author-handle text-secondary">
                  @{post.author.handle}
                </span>
              )}
            </div>
            <time className="post-time text-tertiary text-caption">
              {formatDistanceToNow(new Date(postDate), { addSuffix: true })}
            </time>
          </div>

          <div className="post-actions">
            <motion.button
              className="btn btn-icon btn-ghost"
              onClick={() => setShowMenu(!showMenu)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MoreHorizontal size={18} />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="post-content">
          <p className="post-text">{postText}</p>
          
          {/* Media Preview */}
          {post.embed?.images && (
            <div className={clsx("post-media", {
              "media-grid": post.embed.images.length > 1
            })}>
              {post.embed.images.map((image: { thumb?: string; fullsize?: string; alt?: string }, index: number) => (
                <motion.div
                  key={index}
                  className="media-item"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <img
                    src={image.thumb || image.fullsize}
                    alt={image.alt || ''}
                    loading="lazy"
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* External Link */}
          {post.embed?.external && (
            <motion.a
              href={post.embed.external.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link-card"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {post.embed.external.thumb && (
                <img
                  src={post.embed.external.thumb}
                  alt=""
                  className="link-thumbnail"
                />
              )}
              <div className="link-content">
                <h4 className="link-title">{post.embed.external.title}</h4>
                <p className="link-description text-secondary">
                  {post.embed.external.description}
                </p>
                <span className="link-url text-tertiary">
                  <Link size={12} />
                  {new URL(post.embed.external.uri).hostname}
                </span>
              </div>
            </motion.a>
          )}
        </div>

        {/* Engagement Bar */}
        <div className="post-engagement">
          <motion.button
            className={clsx("engagement-btn", { active: false })}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageCircle size={18} />
            <span>{post.replyCount || 0}</span>
          </motion.button>

          <motion.button
            className={clsx("engagement-btn", { active: reposted })}
            onClick={handleRepost}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={{ rotate: reposted ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Repeat2 size={18} />
            </motion.div>
            <span>{repostCount}</span>
          </motion.button>

          <motion.button
            className={clsx("engagement-btn like-btn", { active: liked })}
            onClick={handleLike}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={{ scale: liked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} />
            </motion.div>
            <span>{likeCount}</span>
          </motion.button>

          <motion.button
            className="engagement-btn"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Share size={18} />
          </motion.button>

          <motion.button
            className="engagement-btn ml-auto"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bookmark size={18} />
          </motion.button>
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="post-menu"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button className="menu-item">Copy link</button>
            <button className="menu-item">Mute thread</button>
            <button className="menu-item danger">Report post</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}