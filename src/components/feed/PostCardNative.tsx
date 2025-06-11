import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Repeat2, MessageCircle, Heart, Share } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { FeedItem, Post } from '../../types/atproto'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import { atUriToWebUrl, copyToClipboard, shareUrl } from '../../utils/url-helpers'
import { getPostText, formatPostTime } from '../../utils/post-helpers'
import { PostEmbeds } from './PostEmbedsNative'

interface PostCardNativeProps {
  item: FeedItem
  onReply?: (post: Post) => void
  onViewThread?: (uri: string) => void
  showParentPost?: boolean
  isThreadChild?: boolean
  isInThread?: boolean
  isMainPost?: boolean
  isParentPost?: boolean
}

export const PostCardNative: React.FC<PostCardNativeProps> = ({ 
  item, 
  onReply, 
  onViewThread, 
  showParentPost = false,
  isThreadChild = false,
  isInThread = false,
  isMainPost = false,
  isParentPost = false
}) => {
  const { post, reply, reason } = item
  const [showMenu, setShowMenu] = useState(false)
  const { likePost, repostPost, isLiking, isReposting } = usePostInteractions()
  
  // Use viewer state to determine if liked/reposted
  const isLiked = !!post.viewer?.like
  const isReposted = !!post.viewer?.repost
  const likeCount = post.likeCount || 0
  const repostCount = post.repostCount || 0
  const replyCount = post.replyCount || 0

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await likePost(post)
  }

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await repostPost(post)
  }

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation()
    onReply?.(post)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const postUrl = atUriToWebUrl(post.uri, post.author.handle)
    const postText = getPostText(post)
    const shareText = postText.length > 100 ? postText.substring(0, 100) + '...' : postText
    
    const shared = await shareUrl(
      postUrl,
      `Post by @${post.author.handle}`,
      shareText
    )
    
    if (!shared) {
      await copyToClipboard(postUrl)
    }
  }

  const handlePostClick = () => {
    if (onViewThread) {
      onViewThread(post.uri)
    }
  }

  return (
    <div className="relative">
      {/* Thread line connector - connects from avatar bottom to next avatar top */}
      {isThreadChild && (
        <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-700" />
      )}

      {/* Repost indicator */}
      {reason && reason.$type === 'app.bsky.feed.defs#reasonRepost' && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-1 text-gray-500">
          <div className="w-12" /> {/* Spacer to align with avatar */}
          <Repeat2 size={14} />
          <span className="text-sm font-medium">
            {reason.by.displayName || reason.by.handle} reposted
          </span>
        </div>
      )}

      {/* Reply indicator for feed view */}
      {!isInThread && item.reply && (
        <div className="flex items-center gap-1.5 px-4 pt-2 text-gray-500 text-sm">
          <div className="w-12" /> {/* Spacer to align with avatar */}
          <MessageCircle size={12} />
          <span>Reply to @{item.reply.parent.author.handle}</span>
        </div>
      )}

      <motion.article 
        className={`relative cursor-pointer transition-colors ${
          isInThread 
            ? isMainPost 
              ? 'px-4 py-4' 
              : isParentPost 
                ? 'px-4 py-2 opacity-90' 
                : 'px-4 py-3'
            : 'bg-gray-900 hover:bg-gray-800/50 px-4 py-3'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={handlePostClick}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <img 
              src={post.author.avatar || '/default-avatar.png'} 
              alt={post.author.handle}
              className="w-12 h-12 rounded-full bg-gray-700"
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className={`font-bold text-gray-100 hover:underline ${
                isMainPost ? 'text-lg' : ''
              }`}>
                {post.author.displayName || post.author.handle}
              </span>
              <span className={`text-gray-500 ${
                isMainPost ? 'text-base' : isParentPost ? 'text-sm' : ''
              }`}>
                @{post.author.handle}
              </span>
              <span className="text-gray-500">·</span>
              <time className={`text-gray-500 hover:underline ${
                isParentPost ? 'text-sm' : ''
              }`}>
                {formatPostTime(post)}
              </time>
            </div>

            {/* Text content */}
            {getPostText(post) && (
              <div className={`mt-1 text-gray-100 whitespace-pre-wrap break-words ${
                isMainPost ? 'text-lg' : isParentPost ? 'text-sm' : ''
              }`}>
                {getPostText(post)}
              </div>
            )}

            {/* Embeds (images, links, quotes) */}
            {post.embed && (
              <div className="mt-2">
                <PostEmbeds embed={post.embed} />
              </div>
            )}

            {/* Engagement bar */}
            <div className="flex items-center gap-4 mt-3 -ml-2">
              {/* Reply */}
              <button
                className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                onClick={handleReply}
              >
                <MessageCircle 
                  size={18} 
                  className="text-gray-500 group-hover:text-blue-500 transition-colors" 
                />
                {replyCount > 0 && (
                  <span className="text-sm text-gray-500 group-hover:text-blue-500 transition-colors">
                    {replyCount}
                  </span>
                )}
              </button>

              {/* Repost */}
              <button
                className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-green-500/10 transition-colors"
                onClick={handleRepost}
                disabled={isReposting}
              >
                <Repeat2 
                  size={18} 
                  className={`transition-colors ${
                    isReposted 
                      ? 'text-green-500' 
                      : 'text-gray-500 group-hover:text-green-500'
                  }`}
                />
                {repostCount > 0 && (
                  <span className={`text-sm transition-colors ${
                    isReposted 
                      ? 'text-green-500' 
                      : 'text-gray-500 group-hover:text-green-500'
                  }`}>
                    {repostCount}
                  </span>
                )}
              </button>

              {/* Like */}
              <button
                className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-pink-500/10 transition-colors"
                onClick={handleLike}
                disabled={isLiking}
              >
                <Heart 
                  size={18} 
                  className={`transition-colors ${
                    isLiked 
                      ? 'text-pink-500 fill-pink-500' 
                      : 'text-gray-500 group-hover:text-pink-500'
                  }`}
                />
                {likeCount > 0 && (
                  <span className={`text-sm transition-colors ${
                    isLiked 
                      ? 'text-pink-500' 
                      : 'text-gray-500 group-hover:text-pink-500'
                  }`}>
                    {likeCount}
                  </span>
                )}
              </button>

              {/* Share */}
              <button
                className="group p-2 rounded-full hover:bg-gray-700/50 transition-colors ml-auto"
                onClick={handleShare}
              >
                <Share 
                  size={18} 
                  className="text-gray-500 group-hover:text-blue-500 transition-colors" 
                />
              </button>
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  )
}