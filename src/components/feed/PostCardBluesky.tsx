import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Repeat2, MessageCircle, Heart, Share, MoreHorizontal } from 'lucide-react'
import type { FeedItem, Post } from '@bsky/shared'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import { atUriToWebUrl, copyToClipboard, shareUrl } from '../../utils/url-helpers'
import { getPostText, formatPostTime } from '../../utils/post-helpers'
import { PostEmbeds } from './PostEmbedsNative'

interface PostCardBlueskyProps {
  item: FeedItem
  onReply?: (post: Post) => void
  onViewThread?: (uri: string) => void
  
  // Thread context props
  isInThread?: boolean      // Is this shown in a thread view?
  isMainPost?: boolean      // Is this the focused post in thread?
  isParentPost?: boolean    // Is this a parent/ancestor in thread?
  hasMoreReplies?: boolean  // Does this have replies below it?
  isLastReply?: boolean     // Is this the last reply in a chain?
  depth?: number           // Reply depth for indentation
}

export const PostCardBluesky: React.FC<PostCardBlueskyProps> = ({ 
  item, 
  onReply, 
  onViewThread,
  isInThread = false,
  isMainPost = false,
  isParentPost = false,
  hasMoreReplies = false,
  isLastReply = false,
  depth = 0
}) => {
  const { post, reply, reason } = item
  const { likePost, repostPost, isLiking, isReposting } = usePostInteractions()
  
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
    
    const shared = await shareUrl(postUrl, `Post by @${post.author.handle}`, shareText)
    if (!shared) {
      await copyToClipboard(postUrl)
    }
  }

  const handlePostClick = () => {
    if (onViewThread) {
      onViewThread(post.uri)
    }
  }

  // Calculate styling based on context
  const containerPadding = isMainPost ? 'px-4 py-3' : 'px-4 py-2.5'
  const textSize = isMainPost ? 'text-[17px] leading-[24px]' : 'text-[15px] leading-[20px]'
  const avatarSize = isMainPost ? 'w-[48px] h-[48px]' : 'w-[40px] h-[40px]'
  
  // Thread line positioning
  const showThreadLine = isInThread && hasMoreReplies && !isMainPost
  const threadLineTop = isMainPost ? 'top-[56px]' : 'top-[48px]' // Adjust based on avatar size
  const threadLineLeft = isMainPost ? '36px' : '32px' // Center under avatar
  
  // Indentation for nested replies
  const leftIndent = depth > 0 ? depth * 12 : 0

  return (
    <div className="relative" style={{ marginLeft: `${leftIndent}px` }}>
      {/* Thread line that connects posts */}
      {showThreadLine && (
        <div 
          className={`absolute ${threadLineTop} bottom-0 w-[2px] bg-gray-800`} 
          style={{ left: threadLineLeft }}
        />
      )}

      {/* Repost indicator */}
      {reason && reason.$type === 'app.bsky.feed.defs#reasonRepost' && (
        <div className="flex items-center gap-2 px-4 pt-2 text-gray-500 text-[13px]">
          <div className="w-12" /> {/* Spacer to align with avatar */}
          <Repeat2 size={16} />
          <span>{reason.by.displayName || reason.by.handle} reposted</span>
        </div>
      )}

      {/* Reply indicator in thread */}
      {isInThread && reply && reply.parent && !isMainPost && (
        <div className="flex items-center px-4 pt-1.5 pb-0.5 text-gray-500 text-[13px]">
          <div className="w-[40px] mr-3" /> {/* Spacer to align with avatar */}
          <span>Replying to @{reply.parent.author?.handle || 'unknown'}</span>
        </div>
      )}

      <motion.article 
        className={`
          relative cursor-pointer transition-colors
          ${!isInThread ? 'hover:bg-gray-800/30' : 'hover:bg-gray-800/10'}
          ${containerPadding}
          ${isMainPost ? 'bg-blue-500/5' : ''}
        `}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        onClick={handlePostClick}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 relative">
            <img 
              src={post.author.avatar || '/default-avatar.png'} 
              alt={post.author.handle}
              className={`${avatarSize} rounded-full bg-gray-700 object-cover`}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-baseline gap-1 flex-wrap min-w-0">
                <span className="font-semibold text-gray-100 truncate">
                  {post.author.displayName || post.author.handle}
                </span>
                <span className="text-gray-500 text-[15px]">
                  @{post.author.handle}
                </span>
                <span className="text-gray-500 text-[15px]">·</span>
                <time className="text-gray-500 text-[15px] hover:underline">
                  {formatPostTime(post)}
                </time>
              </div>
              
              {/* Menu button */}
              <button
                className="p-1 -mr-1 rounded-full hover:bg-gray-700/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Show menu
                }}
              >
                <MoreHorizontal size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Text content */}
            {getPostText(post) && (
              <div className={`mt-1 text-gray-100 whitespace-pre-wrap break-words ${textSize}`}>
                {getPostText(post)}
              </div>
            )}

            {/* Embeds */}
            {post.embed && (
              <div className="mt-2">
                <PostEmbeds embed={post.embed} onViewThread={onViewThread} />
              </div>
            )}

            {/* Engagement bar */}
            <div className="flex items-center gap-3 mt-2 -ml-2">
              {/* Reply */}
              <button
                className="group flex items-center gap-1 p-2 -m-2 rounded-full hover:bg-gray-700/50 transition-all"
                onClick={handleReply}
              >
                <MessageCircle 
                  size={18} 
                  className="text-gray-500 group-hover:text-blue-500 transition-colors" 
                />
                <span className="text-[13px] text-gray-500 group-hover:text-blue-500 min-w-[1rem]">
                  {replyCount > 0 ? replyCount : ''}
                </span>
              </button>

              {/* Repost */}
              <button
                className="group flex items-center gap-1 p-2 -m-2 rounded-full hover:bg-green-500/10 transition-all"
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
                <span className={`text-[13px] min-w-[1rem] transition-colors ${
                  isReposted 
                    ? 'text-green-500' 
                    : 'text-gray-500 group-hover:text-green-500'
                }`}>
                  {repostCount > 0 ? repostCount : ''}
                </span>
              </button>

              {/* Like */}
              <button
                className="group flex items-center gap-1 p-2 -m-2 rounded-full hover:bg-pink-500/10 transition-all"
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
                <span className={`text-[13px] min-w-[1rem] transition-colors ${
                  isLiked 
                    ? 'text-pink-500' 
                    : 'text-gray-500 group-hover:text-pink-500'
                }`}>
                  {likeCount > 0 ? likeCount : ''}
                </span>
              </button>

              {/* Share */}
              <button
                className="p-2 -m-2 rounded-full hover:bg-gray-700/50 transition-all ml-auto"
                onClick={handleShare}
              >
                <Share 
                  size={18} 
                  className="text-gray-500 hover:text-blue-500 transition-colors" 
                />
              </button>
            </div>
          </div>
        </div>
      </motion.article>

      {/* Bottom border */}
      <div className="border-b border-gray-800" />
    </div>
  )
}