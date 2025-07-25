import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Send, Image, AtSign, Hash, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getInteractionsService } from '@bsky/shared/services/atproto'
import { useAuth } from '../../contexts/AuthContext'
import { useErrorHandler } from '../../hooks/useErrorHandler'
import type { Post } from '@bsky/shared/types/atproto'

interface ComposeModalProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: {
    post: Post
    root?: Post
  }
  template?: string
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ 
  isOpen, 
  onClose, 
  replyTo,
  template
}) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { session } = useAuth()
  const { handleError } = useErrorHandler()
  const queryClient = useQueryClient()
  
  // Set template text when template changes
  useEffect(() => {
    if (template && isOpen) {
      switch (template) {
        case 'question':
          setText('What\'s your opinion on ')
          break
        case 'reactivation':
          setText('Something I\'ve been thinking about lately: ')
          break
        default:
          setText('')
      }
    }
  }, [template, isOpen])
  
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
      const { atProtoClient } = await import('../../services/atproto')
      const agent = atProtoClient.getAgent()
      if (!agent) throw new Error('Not authenticated')
      const interactionsService = getInteractionsService(agent)
      
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
        className="fixed inset-0 bg-black/50 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-gray-900 rounded-xl shadow-xl z-50 overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-xl font-semibold">
                {replyTo ? 'Reply' : 'New Post'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                disabled={createPostMutation.isPending}
              >
                <X size={20} />
              </button>
            </div>

            {/* Reply context */}
            {replyTo && (
              <div className="relative px-4 pt-2 pb-0">
                <div className="absolute left-11 top-8 bottom-0 w-0.5 bg-gray-700"></div>
                <div className="flex gap-3">
                  <img 
                    src={replyTo.post.author.avatar} 
                    alt={replyTo.post.author.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {replyTo.post.author.displayName || replyTo.post.author.handle}
                    </div>
                    <div className="text-gray-400 text-sm line-clamp-2">
                      {(replyTo.post.record as { text?: string })?.text || ''}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-4">
              {/* Author info */}
              <div className="flex items-center gap-2 mb-3">
                {session?.handle && (
                  <>
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                      {session.handle.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-400">@{session.handle}</span>
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
                className="w-full bg-transparent border-none outline-none resize-none text-lg placeholder-gray-500 min-h-[120px]"
                disabled={createPostMutation.isPending}
                maxLength={characterLimit * 2} // Allow typing over limit for better UX
              />

              {/* Actions bar */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-400 opacity-50 cursor-not-allowed"
                    title="Add image (coming soon)"
                    disabled
                  >
                    <Image size={20} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-400 opacity-50 cursor-not-allowed"
                    title="Mention someone (coming soon)"
                    disabled
                  >
                    <AtSign size={20} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-400 opacity-50 cursor-not-allowed"
                    title="Add hashtag (coming soon)"
                    disabled
                  >
                    <Hash size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${
                    isOverLimit ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {charactersRemaining}
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-full font-medium transition-colors flex items-center gap-2"
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