import React, { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface InlineReplyComposerProps {
  replyTo: {
    uri: string
    cid: string
    author: {
      handle: string
      displayName?: string
    }
  }
  root?: {
    uri: string
    cid: string
  }
  onClose: () => void
  onSuccess?: () => void
}

export function InlineReplyComposer({ replyTo, root, onClose, onSuccess }: InlineReplyComposerProps) {
  const { agent } = useAuth()
  const [text, setText] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!agent || !text.trim() || isPosting) return

    setIsPosting(true)
    setError(null)

    try {
      // Get the reply structure from the post being replied to
      const replyRecord = {
        text: text.trim(),
        reply: {
          // If a root is provided, use it. Otherwise, this post might be the root
          root: root || {
            uri: replyTo.uri,
            cid: replyTo.cid
          },
          // Always reply to the specific post clicked
          parent: {
            uri: replyTo.uri,
            cid: replyTo.cid
          }
        }
      }
      
      await agent.post(replyRecord)

      setText('')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to post reply:', err)
      setError('Failed to post reply. Please try again.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Always stop propagation to prevent parent handlers
    e.stopPropagation()
    
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Enter') {
      // Prevent plain Enter from bubbling up and triggering navigation
      e.preventDefault()
    }
    
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div 
      className="border rounded-lg p-3 mt-2" 
      style={{ 
        backgroundColor: 'var(--bsky-bg-primary)',
        borderColor: 'var(--bsky-border-primary)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
          Replying to @{replyTo.author.handle}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 transition-colors"
          aria-label="Cancel reply"
        >
          <X size={16} style={{ color: 'var(--bsky-text-tertiary)' }} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply..."
        className="w-full p-2 rounded border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          backgroundColor: 'var(--bsky-bg-secondary)',
          borderColor: 'var(--bsky-border-primary)',
          color: 'var(--bsky-text-primary)',
          minHeight: '60px'
        }}
        rows={2}
        maxLength={300}
        disabled={isPosting}
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ 
          color: text.length > 280 ? 'var(--bsky-danger)' : 'var(--bsky-text-tertiary)' 
        }}>
          {text.length}/300
        </span>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs" style={{ color: 'var(--bsky-danger)' }}>
              {error}
            </span>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isPosting || text.length > 300}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bsky-primary)',
              color: 'white'
            }}
          >
            {isPosting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Reply</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs mt-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
        Tip: Press Ctrl+Enter to send • Esc to cancel
      </div>
    </div>
  )
}