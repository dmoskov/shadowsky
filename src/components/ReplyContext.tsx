import React from 'react'
import { MessageCircle, CornerDownRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Post, Reply } from '../types/atproto'

interface ReplyContextProps {
  reply?: Reply
  post: Post
  isInThread?: boolean
}

export const ReplyContext: React.FC<ReplyContextProps> = ({ reply, post, isInThread = false }) => {
  const navigate = useNavigate()
  
  if (!reply?.parent) return null
  
  const handleClick = () => {
    navigate(`/thread/${encodeURIComponent(reply.parent.uri)}`)
  }
  
  return (
    <div className="reply-context">
      <div className="reply-context-line" />
      <button 
        className="reply-context-content"
        onClick={handleClick}
        aria-label={`View reply to ${reply.parent.author.handle}`}
      >
        <CornerDownRight size={14} className="reply-icon" />
        <span className="reply-text">
          Replying to{' '}
          <span className="reply-author">@{reply.parent.author.handle}</span>
          {reply.root && reply.root.uri !== reply.parent.uri && (
            <span className="reply-thread-info"> in thread</span>
          )}
        </span>
      </button>
    </div>
  )
}

// Inline reply indicator for feed view
export const InlineReplyIndicator: React.FC<{ handle: string }> = ({ handle }) => (
  <div className="inline-reply-indicator">
    <MessageCircle size={12} />
    <span>Replying to @{handle}</span>
  </div>
)