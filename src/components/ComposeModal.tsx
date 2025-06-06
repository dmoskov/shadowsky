import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Send, Image, AtSign, Hash, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { interactionsService } from '../services/atproto'
import { useAuth } from '../contexts/AuthContext'
import { useErrorHandler } from '../hooks/useErrorHandler'
import type { Post } from '../types/atproto'

interface ComposeModalProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: {
    post: Post
    root?: Post
  }
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ 
  isOpen, 
  onClose, 
  replyTo 
}) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { session } = useAuth()
  const { handleError } = useErrorHandler()
  const queryClient = useQueryClient()
  
  const characterLimit = 300
  const charactersRemaining = characterLimit - text.length
  const isOverLimit = charactersRemaining < 0

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [text])

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (replyTo) {
        // Creating a reply
        const replyData = {
          root: replyTo.root 
            ? { uri: replyTo.root.uri, cid: replyTo.root.cid }
            : { uri: replyTo.post.uri, cid: replyTo.post.cid },
          parent: { uri: replyTo.post.uri, cid: replyTo.post.cid }
        }
        return await interactionsService.createReply(text, replyData)
      } else {
        // Creating a new post
        return await interactionsService.createPost(text)
      }
    },
    onSuccess: () => {
      // Invalidate timeline to show new post
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      setText('')
      onClose()
    },
    onError: (error) => {
      handleError(error)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim() && !isOverLimit && !createPostMutation.isPending) {
      createPostMutation.mutate()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        className="compose-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
            <div className="compose-header">
              <h2 className="compose-title">
                {replyTo ? 'Reply' : 'New Post'}
              </h2>
              <button
                onClick={onClose}
                className="btn btn-icon btn-ghost"
                disabled={createPostMutation.isPending}
              >
                <X size={20} />
              </button>
            </div>

            {/* Reply context */}
            {replyTo && (
              <div className="reply-context-preview">
                <div className="reply-line-preview"></div>
                <div className="reply-to-info">
                  <img 
                    src={replyTo.post.author.avatar} 
                    alt={replyTo.post.author.displayName}
                    className="reply-to-avatar"
                  />
                  <div>
                    <div className="reply-to-author">
                      {replyTo.post.author.displayName || replyTo.post.author.handle}
                    </div>
                    <div className="reply-to-text">
                      {(replyTo.post.record as { text?: string })?.text || ''}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="compose-form">
              {/* Author info */}
              <div className="compose-author">
                {session?.handle && (
                  <>
                    <div className="compose-avatar">
                      {session.handle.charAt(0).toUpperCase()}
                    </div>
                    <span className="compose-handle">@{session.handle}</span>
                  </>
                )}
              </div>

              {/* Text input */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={replyTo ? "Post your reply" : "What's happening?"}
                className="compose-textarea"
                disabled={createPostMutation.isPending}
                maxLength={characterLimit * 2} // Allow typing over limit for better UX
              />

              {/* Actions bar */}
              <div className="compose-actions">
                <div className="compose-tools">
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    title="Add image (coming soon)"
                    disabled
                  >
                    <Image size={20} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    title="Mention someone (coming soon)"
                    disabled
                  >
                    <AtSign size={20} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    title="Add hashtag (coming soon)"
                    disabled
                  >
                    <Hash size={20} />
                  </button>
                </div>

                <div className="compose-submit">
                  <span className={`character-count ${isOverLimit ? 'over-limit' : ''}`}>
                    {charactersRemaining}
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!text.trim() || isOverLimit || createPostMutation.isPending}
                  >
                    {createPostMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>{replyTo ? 'Reply' : 'Post'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
    </>
  )
}