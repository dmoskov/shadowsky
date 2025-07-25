import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Repeat2 } from 'lucide-react'
import { ParentPost } from '../thread/ParentPost'
import { PostHeaderTailwind } from './PostHeaderTailwind'
import { PostContentTailwind } from './PostContentTailwind'
import { PostEngagementBarTailwind } from './PostEngagementBarTailwind'
import { PostMenu } from './PostMenu'
import type { FeedItem, Post } from '@bsky/shared'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import { atUriToWebUrl, copyToClipboard, shareUrl } from '../../utils/url-helpers'
import { getPostText } from '../../utils/post-helpers'

interface PostCardProps {
  item: FeedItem
  onReply?: (post: Post) => void
  onViewThread?: (uri: string) => void
  showParentPost?: boolean
}

export const PostCardTailwind: React.FC<PostCardProps> = ({ 
  item, 
  onReply, 
  onViewThread, 
  showParentPost = false 
}) => {
  const { post, reply, reason } = item
  const [showMenu, setShowMenu] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const { likePost, repostPost, isLiking, isReposting } = usePostInteractions()
  
  // Use viewer state to determine if liked/reposted
  const isLiked = !!post.viewer?.like
  const isReposted = !!post.viewer?.repost
  const likeCount = post.likeCount || 0
  const repostCount = post.repostCount || 0

  const handleLike = async () => {
    try {
      console.log('Like button clicked for post:', post.uri)
      await likePost(post)
    } catch (error) {
      console.error('Like failed:', error)
    }
  }

  const handleRepost = async () => {
    await repostPost(post)
  }

  const handleShare = async () => {
    const postUrl = atUriToWebUrl(post.uri, post.author.handle)
    const postText = getPostText(post)
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
    const success = await copyToClipboard(postUrl)
    if (success) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const handlePostClick = () => {
    if (onViewThread) {
      onViewThread(post.uri)
    }
  }

  const handleReply = () => {
    onReply?.(post)
  }

  return (
    <>
      {/* Repost indicator */}
      {reason && reason.$type === 'app.bsky.feed.defs#reasonRepost' && (
        <div className="repost-indicator">
          <Repeat2 size={16} />
          <span className="text-secondary text-sm">
            {reason.by.displayName || reason.by.handle} reposted
          </span>
        </div>
      )}

      {/* Parent post if this is a reply */}
      {showParentPost && reply && reply.parent && (
        <ParentPost post={reply.parent} />
      )}

      <motion.article 
        className="tw-post-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={handlePostClick}
      >
        {/* Header */}
        <PostHeaderTailwind 
          post={post}
          onMenuToggle={() => setShowMenu(!showMenu)}
        />

        {/* Content */}
        <PostContentTailwind
          item={item}
          post={post}
          showParentPost={showParentPost}
          onViewThread={onViewThread}
        />

        {/* Engagement Bar */}
        <PostEngagementBarTailwind
          post={post}
          isLiked={isLiked}
          isReposted={isReposted}
          likeCount={likeCount}
          repostCount={repostCount}
          isLiking={isLiking}
          isReposting={isReposting}
          onReply={handleReply}
          onRepost={handleRepost}
          onLike={handleLike}
          onShare={handleShare}
        />

        {/* Dropdown Menu */}
        <PostMenu
          isOpen={showMenu}
          onCopyLink={handleCopyLink}
          copiedLink={copiedLink}
        />
      </motion.article>
    </>
  )
}