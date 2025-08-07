import React, { useState, useRef } from 'react'
import { Send, Image, Smile, X, Loader, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { GiphySearch } from './GiphySearch'
import { EmojiPicker } from './EmojiPicker'
import { generateAltText } from '../services/anthropic'
import { compressImage, isCompressibleImage } from '../utils/image-compression'
import { debug } from '../shared/debug'
import '../styles/base-composer.css'

interface UploadedMedia {
  id: string
  file: File
  preview: string
  alt: string
  type: 'image' | 'video'
}

interface BaseComposerProps {
  // Core functionality
  onSubmit: (text: string, media?: UploadedMedia[]) => Promise<void>
  maxLength?: number
  placeholder?: string
  initialText?: string
  
  // Reply context (optional)
  replyTo?: {
    uri: string
    cid: string
    author: { handle: string; displayName?: string }
  }
  
  // Feature toggles
  features?: {
    media?: boolean
    emoji?: boolean
    giphy?: boolean
    altTextGeneration?: boolean
    shortcuts?: boolean
  }
  
  // UI customization
  layout?: 'inline' | 'full'
  showCharCount?: boolean
  submitLabel?: string
  submitIcon?: React.ReactNode
  
  // Callbacks
  onCancel?: () => void
  onChange?: (text: string) => void
  onFocus?: () => void
  onBlur?: () => void
  
  // Auto-focus
  autoFocus?: boolean
}

const MAX_IMAGE_SIZE = 1000000 // 1MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_IMAGES = 4
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mpeg', '.webm', '.mov']

export function BaseComposer({
  onSubmit,
  maxLength = 300,
  placeholder = "What's happening?",
  initialText = '',
  replyTo,
  features = {
    media: true,
    emoji: true,
    giphy: false,
    altTextGeneration: true,
    shortcuts: true
  },
  layout = 'full',
  showCharCount = true,
  submitLabel = 'Post',
  submitIcon = <Send size={layout === 'inline' ? 16 : 20} />,
  onCancel,
  onChange,
  onFocus,
  onBlur,
  autoFocus = false
}: BaseComposerProps) {
  const { agent } = useAuth()
  const [text, setText] = useState(initialText)
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifSearch, setShowGifSearch] = useState(false)
  const [generatingAlt, setGeneratingAlt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    if (newText.length <= maxLength) {
      setText(newText)
      onChange?.(newText)
      setError(null)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (features.shortcuts && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault()
      onCancel()
    }
    // Stop propagation to prevent parent handlers
    e.stopPropagation()
  }

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      await addMedia(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Add media file
  const addMedia = async (file: File) => {
    try {
      // Check if it's a video
      const isVideo = SUPPORTED_VIDEO_FORMATS.some(format => file.name.toLowerCase().endsWith(format))
      
      if (isVideo) {
        if (media.some(m => m.type === 'video')) {
          setError('Only one video can be uploaded at a time')
          return
        }
        if (file.size > MAX_VIDEO_SIZE) {
          setError('Video must be less than 50MB')
          return
        }
      } else {
        // Check image limits
        const imageCount = media.filter(m => m.type === 'image').length
        if (imageCount >= MAX_IMAGES) {
          setError(`Maximum ${MAX_IMAGES} images allowed`)
          return
        }
        
        // Compress image if needed
        let processedFile = file
        if (isCompressibleImage(file) && file.size > MAX_IMAGE_SIZE) {
          try {
            processedFile = await compressImage(file)
            debug.log('Image compressed', { 
              original: file.size, 
              compressed: processedFile.size 
            })
          } catch (error) {
            debug.error('Failed to compress image:', error)
          }
        }
        
        if (processedFile.size > MAX_IMAGE_SIZE) {
          setError('Image must be less than 1MB')
          return
        }
        file = processedFile
      }

      // Create preview
      const preview = URL.createObjectURL(file)
      const newMedia: UploadedMedia = {
        id: Date.now().toString(),
        file: file,
        preview,
        alt: '',
        type: isVideo ? 'video' : 'image'
      }

      setMedia(prev => [...prev, newMedia])
      setError(null)
    } catch (error) {
      debug.error('Failed to add media:', error)
      setError('Failed to add media')
    }
  }

  // Remove media
  const removeMedia = (id: string) => {
    setMedia(prev => {
      const item = prev.find(m => m.id === id)
      if (item) {
        URL.revokeObjectURL(item.preview)
      }
      return prev.filter(m => m.id !== id)
    })
  }

  // Update alt text
  const updateAltText = (id: string, alt: string) => {
    setMedia(prev => prev.map(m => m.id === id ? { ...m, alt } : m))
  }

  // Generate alt text with AI
  const handleGenerateAlt = async (id: string) => {
    const item = media.find(m => m.id === id)
    if (!item || item.type !== 'image') return

    setGeneratingAlt(id)
    try {
      const alt = await generateAltText(item.preview)
      updateAltText(id, alt)
    } catch (error) {
      debug.error('Failed to generate alt text:', error)
      setError('Failed to generate alt text')
    } finally {
      setGeneratingAlt(null)
    }
  }

  // Handle paste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          await addMedia(file)
        }
      }
    }
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!agent || isSubmitting || (!text.trim() && media.length === 0)) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(text.trim(), media)
      
      // Reset form
      setText('')
      setMedia([])
      setShowEmojiPicker(false)
      setShowGifSearch(false)
    } catch (error) {
      debug.error('Failed to submit:', error)
      setError(error instanceof Error ? error.message : 'Failed to post')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = text.slice(0, start) + emoji + text.slice(end)
    
    if (newText.length <= maxLength) {
      setText(newText)
      onChange?.(newText)
      
      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + emoji.length, start + emoji.length)
      }, 0)
    }
    
    setShowEmojiPicker(false)
  }

  // Handle GIF selection
  const handleGifSelect = async (gifUrl: string) => {
    try {
      const response = await fetch(gifUrl)
      const blob = await response.blob()
      const file = new File([blob], 'gif.gif', { type: 'image/gif' })
      await addMedia(file)
      setShowGifSearch(false)
    } catch (error) {
      debug.error('Failed to add GIF:', error)
      setError('Failed to add GIF')
    }
  }

  const isInline = layout === 'inline'

  return (
    <div className={`base-composer ${isInline ? 'base-composer-inline' : 'base-composer-full'}`}>
      {/* Reply context */}
      {replyTo && (
        <div className="mb-2 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
          Replying to @{replyTo.author.handle}
        </div>
      )}

      {/* Main composer area */}
      <div className={`flex ${isInline ? 'gap-2' : 'flex-col gap-3'}`}>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            autoFocus={autoFocus}
            onFocus={() => {
              onFocus?.()
              // Stop propagation to prevent parent handlers
              event?.stopPropagation()
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            className={`w-full resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isInline ? 'min-h-[40px]' : 'min-h-[100px]'
            }`}
            style={{
              backgroundColor: 'var(--bsky-bg-secondary)',
              borderColor: 'var(--bsky-border-primary)',
              color: 'var(--bsky-text-primary)'
            }}
          />

          {/* Media preview */}
          {media.length > 0 && (
            <div className={`mt-2 ${isInline ? 'flex gap-2' : 'grid grid-cols-2 gap-2'}`}>
              {media.map(item => (
                <div key={item.id} className="relative group">
                  {item.type === 'image' ? (
                    <img
                      src={item.preview}
                      alt={item.alt}
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : (
                    <video
                      src={item.preview}
                      className="w-full h-32 object-cover rounded"
                      controls
                    />
                  )}
                  
                  {/* Remove button */}
                  <button
                    onClick={() => removeMedia(item.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>

                  {/* Alt text input */}
                  {item.type === 'image' && !isInline && (
                    <div className="mt-1 flex gap-1">
                      <input
                        type="text"
                        value={item.alt}
                        onChange={(e) => updateAltText(item.id, e.target.value)}
                        placeholder="Alt text"
                        className="flex-1 text-xs px-2 py-1 rounded border"
                        style={{
                          backgroundColor: 'var(--bsky-bg-secondary)',
                          borderColor: 'var(--bsky-border-primary)',
                          color: 'var(--bsky-text-primary)'
                        }}
                      />
                      {features.altTextGeneration && (
                        <button
                          onClick={() => handleGenerateAlt(item.id)}
                          disabled={generatingAlt === item.id}
                          className="text-xs px-2 py-1 rounded border hover:bg-gray-100 dark:hover:bg-gray-800"
                          style={{ borderColor: 'var(--bsky-border-primary)' }}
                        >
                          {generatingAlt === item.id ? (
                            <Loader size={12} className="animate-spin" />
                          ) : (
                            'Generate'
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Character count and error */}
          <div className="flex items-center justify-between mt-1">
            {showCharCount && (
              <span className={`text-xs ${text.length > maxLength * 0.9 ? 'text-orange-500' : ''}`} 
                    style={{ color: text.length <= maxLength * 0.9 ? 'var(--bsky-text-secondary)' : undefined }}>
                {text.length}/{maxLength}
              </span>
            )}
            {error && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className={`flex ${isInline ? 'flex-col' : 'flex-row items-end'} gap-2`}>
          {features.media && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className={`p-2 rounded-full transition-all hover:scale-110 ${
                  isInline ? 'w-8 h-8' : ''
                }`}
                style={{
                  backgroundColor: 'var(--bsky-bg-tertiary)',
                  color: 'var(--bsky-text-secondary)'
                }}
                title="Add image or video"
              >
                <Image size={isInline ? 16 : 20} />
              </button>
            </>
          )}

          {features.emoji && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isSubmitting}
                className={`p-2 rounded-full transition-all hover:scale-110 ${
                  isInline ? 'w-8 h-8' : ''
                }`}
                style={{
                  backgroundColor: 'var(--bsky-bg-tertiary)',
                  color: 'var(--bsky-text-secondary)'
                }}
                title="Add emoji"
              >
                <Smile size={isInline ? 16 : 20} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <EmojiPicker 
                    onSelectEmoji={handleEmojiSelect} 
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && media.length === 0)}
            className={`${
              isInline 
                ? 'p-2 rounded-full w-8 h-8' 
                : 'px-4 py-2 rounded-full flex items-center gap-2'
            } transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{
              backgroundColor: 'var(--bsky-primary)',
              color: 'white'
            }}
            title={features.shortcuts ? `${submitLabel} (Ctrl/Cmd + Enter)` : submitLabel}
          >
            {isSubmitting ? (
              <Loader size={isInline ? 16 : 20} className="animate-spin" />
            ) : (
              <>
                {submitIcon}
                {!isInline && <span>{submitLabel}</span>}
              </>
            )}
          </button>

          {onCancel && !isInline && (
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full border"
              style={{
                borderColor: 'var(--bsky-border-primary)',
                color: 'var(--bsky-text-secondary)'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* GIF search modal */}
      {features.giphy && showGifSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Search GIFs</h3>
              <button
                onClick={() => setShowGifSearch(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <GiphySearch 
              onSelectGif={handleGifSelect} 
              onClose={() => setShowGifSearch(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}