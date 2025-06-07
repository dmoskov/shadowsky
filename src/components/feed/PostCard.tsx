import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Share,
  MoreHorizontal,
  Bookmark,
  Link,
  Check
} from 'lucide-react'
import clsx from 'clsx'
import { ParentPost } from '../thread/ParentPost'
import { ReplyContext } from '../ui/ReplyContext'
import type { FeedItem, Post } from '../../types/atproto'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import { atUriToWebUrl, copyToClipboard, shareUrl } from '../../utils/url-helpers'

interface PostCardProps {
  item: FeedItem
  onReply?: (post: Post) => void
  onViewThread?: (uri: string) => void
  showParentPost?: boolean
}

export const PostCard: React.FC<PostCardProps> = ({ item, onReply, onViewThread, showParentPost = false }) => {
  const { post, reply, reason } = item
  const [showMenu, setShowMenu] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const { likePost, repostPost, isLiking, isReposting } = usePostInteractions()
  const navigate = useNavigate()
  
  // Use viewer state to determine if liked/reposted
  const isLiked = !!post.viewer?.like
  const isReposted = !!post.viewer?.repost
  const likeCount = post.likeCount || 0
  const repostCount = post.repostCount || 0

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

  const handleLike = async () => {
    await likePost(post)
  }

  const handleRepost = async () => {
    await repostPost(post)
  }

  const handleShare = async () => {
    const postUrl = atUriToWebUrl(post.uri, post.author.handle)
    const postText = getPostText()
    const shareText = postText.length > 100 ? postText.substring(0, 100) + '...' : postText
    
    const shared = await shareUrl(
      postUrl,
      `Post by @${post.author.handle}`,
      shareText
    )
    
    if (!shared && !navigator.share) {
      // If share failed and Web Share API not available, copy link as fallback
      handleCopyLink()
    }
  }

  const handleCopyLink = async () => {
    const postUrl = atUriToWebUrl(post.uri, post.author.handle)
    const copied = await copyToClipboard(postUrl)
    
    if (copied) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const postText = getPostText()
  const postDate = getPostDate()

  return (
    <div className="post-wrapper">
      {/* Show parent post if this is a reply AND showParentPost is true */}
      {showParentPost && reply && reply.parent && (
        <ParentPost post={reply.parent} />
      )}
      
      <motion.article
        className={clsx("post-card card", {
          "is-reply": !!reply,
          "is-repost": !!reason
        })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          // Only navigate if clicking on the card itself, not buttons
          if (
            onViewThread &&
            (e.target as HTMLElement).closest('.engagement-btn') === null &&
            (e.target as HTMLElement).closest('.btn') === null &&
            (e.target as HTMLElement).closest('a') === null &&
            (e.target as HTMLElement).closest('.quoted-post') === null
          ) {
            onViewThread(post.uri)
          }
        }}
        style={{ cursor: onViewThread ? 'pointer' : 'default' }}
      >
      {/* Repost Indicator */}
      {reason && '$type' in reason && reason.$type === 'app.bsky.feed.defs#reasonRepost' && (
        <div className="repost-indicator">
          <Repeat2 size={14} />
          <span className="text-secondary text-caption">
            {(reason as any).by?.displayName || (reason as any).by?.handle} reposted
          </span>
        </div>
      )}
      

      <div className="post-card-body">
        {/* Author Section */}
        <div className="post-author">
          <div 
            className="post-author-avatar clickable"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/profile/${post.author.handle}`)
            }}
          >
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
            <div 
              className="post-author-name clickable"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/profile/${post.author.handle}`)
              }}
            >
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
          {/* Reply context */}
          {item.reply && !showParentPost && (
            <ReplyContext reply={item.reply} post={post} />
          )}
          <p className="post-text">{postText}</p>
          
          {/* Quoted Post */}
          {post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.record#view' && (
            <motion.div 
              className="quoted-post"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Quoted post clicked, embed:', post.embed);
                console.log('Record:', (post.embed as any).record);
                const uri = (post.embed as any).record?.uri;
                console.log('URI:', uri);
                if (uri && onViewThread) {
                  console.log('Calling onViewThread with URI:', uri);
                  onViewThread(uri);
                  console.log('onViewThread called successfully');
                }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  const uri = (post.embed as any).record?.uri;
                  if (uri && onViewThread) {
                    onViewThread(uri);
                  }
                }
              }}
            >
              {(post.embed as any).record && 'author' in (post.embed as any).record && (
                <>
                  <div className="quoted-post-author">
                    <img 
                      src={(post.embed as any).record.author.avatar} 
                      alt="" 
                      className="quoted-avatar"
                    />
                    <span className="author-display-name">
                      {(post.embed as any).record.author.displayName || (post.embed as any).record.author.handle}
                    </span>
                    <span className="text-tertiary">@{(post.embed as any).record.author.handle}</span>
                  </div>
                  <p className="quoted-post-text">
                    {(post.embed as any).record.value?.text || ''}
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* Media Preview */}
          {post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.images#view' && (post.embed as any).images && (
            <div className={clsx("post-media", {
              "media-grid": (post.embed as any).images.length > 1
            })}>
              {(post.embed as any).images.map((image: { thumb?: string; fullsize?: string; alt?: string }, index: number) => (
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
          {post.embed && '$type' in post.embed && post.embed.$type === 'app.bsky.embed.external#view' && (post.embed as any).external && (
            <motion.a
              href={(post.embed as any).external.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link-card"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {(post.embed as any).external.thumb && (
                <img
                  src={(post.embed as any).external.thumb}
                  alt=""
                  className="link-thumbnail"
                />
              )}
              <div className="link-content">
                <h4 className="link-title">{(post.embed as any).external.title}</h4>
                <p className="link-description text-secondary">
                  {(post.embed as any).external.description}
                </p>
                <span className="link-url text-tertiary">
                  <Link size={12} />
                  {new URL((post.embed as any).external.uri).hostname}
                </span>
              </div>
            </motion.a>
          )}
        </div>

        {/* Engagement Bar */}
        <div className="post-engagement">
          <motion.button
            className={clsx("engagement-btn", { active: false })}
            onClick={() => onReply?.(post)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageCircle size={18} />
            <span>{post.replyCount || 0}</span>
          </motion.button>

          <motion.button
            className={clsx("engagement-btn", { active: isReposted, reposted: isReposted })}
            onClick={handleRepost}
            disabled={isReposting}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={{ rotate: isReposted ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Repeat2 size={18} />
            </motion.div>
            <span>{repostCount}</span>
          </motion.button>

          <motion.button
            className={clsx("engagement-btn like-btn", { active: isLiked })}
            onClick={handleLike}
            disabled={isLiking}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
            </motion.div>
            <span>{likeCount}</span>
          </motion.button>

          <motion.button
            className="engagement-btn"
            onClick={handleShare}
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
      {showMenu && (
        <motion.div
          className="post-menu"
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button 
            className="menu-item"
            onClick={() => {
              handleCopyLink()
              setShowMenu(false)
            }}
          >
            {copiedLink ? (
              <>
                <Check size={16} />
                <span>Link copied!</span>
              </>
            ) : (
              'Copy link'
            )}
          </button>
          <button className="menu-item">Mute thread</button>
          <button className="menu-item danger">Report post</button>
        </motion.div>
      )}
      </motion.article>
    </div>
  )
}