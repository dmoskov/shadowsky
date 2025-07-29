import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Send, Split, Settings, AlertCircle, CheckCircle, Loader, Image, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getInteractionsService } from '@bsky/shared'

interface NumberingFormat {
  id: string
  name: string
  format: (index: number, total: number) => string
  example: string
}

interface UploadedImage {
  id: string
  file: File
  preview: string
  alt: string
}

const NUMBERING_FORMATS: NumberingFormat[] = [
  {
    id: 'none',
    name: 'No numbering',
    format: () => '',
    example: ''
  },
  {
    id: 'simple',
    name: 'Simple (1/5)',
    format: (i, t) => `${i}/${t}`,
    example: '1/5'
  },
  {
    id: 'brackets',
    name: 'Brackets [1/5]',
    format: (i, t) => `[${i}/${t}]`,
    example: '[1/5]'
  },
  {
    id: 'thread',
    name: 'Thread 🧵',
    format: (i, t) => i === 1 ? '🧵 1/' + t : `${i}/${t}`,
    example: '🧵 1/5'
  },
  {
    id: 'dots',
    name: 'Dots (1•5)',
    format: (i, t) => `${i}•${t}`,
    example: '1•5'
  }
]

const MAX_POST_LENGTH = 300
const MAX_IMAGE_SIZE = 1024 * 1024 // 1MB
const MAX_IMAGES_PER_POST = 4

export function Composer() {
  const { agent } = useAuth()
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<string[]>([])
  const [numberingFormat, setNumberingFormat] = useState('simple')
  const [showSettings, setShowSettings] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<{ type: 'idle' | 'posting' | 'success' | 'error', message?: string }>({ type: 'idle' })
  const [images, setImages] = useState<UploadedImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-split text into posts when it changes
  useEffect(() => {
    if (!text.trim()) {
      setPosts([])
      return
    }

    const words = text.split(' ')
    const splitPosts: string[] = []
    let currentPost = ''

    for (const word of words) {
      const testPost = currentPost ? `${currentPost} ${word}` : word
      
      // Account for numbering in length calculation
      const format = NUMBERING_FORMATS.find(f => f.id === numberingFormat)
      const numberingLength = format && numberingFormat !== 'none' ? 
        format.format(splitPosts.length + 1, 999).length + 2 : 0 // +2 for space and safety margin
      
      if (testPost.length + numberingLength <= MAX_POST_LENGTH) {
        currentPost = testPost
      } else {
        if (currentPost) {
          splitPosts.push(currentPost)
        }
        currentPost = word
      }
    }

    if (currentPost) {
      splitPosts.push(currentPost)
    }

    setPosts(splitPosts)
  }, [text, numberingFormat])

  const applyNumbering = useCallback((posts: string[]): string[] => {
    if (numberingFormat === 'none') return posts
    
    const format = NUMBERING_FORMATS.find(f => f.id === numberingFormat)
    if (!format) return posts

    return posts.map((post, index) => {
      const numbering = format.format(index + 1, posts.length)
      return `${numbering} ${post}`
    })
  }, [numberingFormat])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setPostStatus({ type: 'error', message: `${file.name} is not an image file` })
        return false
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setPostStatus({ type: 'error', message: `${file.name} is too large (max 1MB)` })
        return false
      }
      return true
    })

    const newImages = validFiles.slice(0, MAX_IMAGES_PER_POST - images.length).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      alt: ''
    }))

    setImages(prev => [...prev, ...newImages])
    
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [images])

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const removed = prev.find(img => img.id === id)
      if (removed) {
        URL.revokeObjectURL(removed.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [])

  const updateImageAlt = useCallback((id: string, alt: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, alt } : img
    ))
  }, [])

  const handleSend = async () => {
    if (!agent || posts.length === 0) return

    setIsPosting(true)
    setPostStatus({ type: 'posting', message: 'Creating thread...' })

    try {
      const interactionsService = getInteractionsService(agent)
      const numberedPosts = applyNumbering(posts)
      
      // Prepare images for upload
      let imageData: Array<{ data: Uint8Array; mimeType: string; alt?: string }> | undefined
      if (images.length > 0) {
        imageData = await Promise.all(
          images.map(async img => ({
            data: new Uint8Array(await img.file.arrayBuffer()),
            mimeType: img.file.type,
            alt: img.alt
          }))
        )
      }
      
      let lastPost: { uri: string; cid: string } | undefined

      for (let i = 0; i < numberedPosts.length; i++) {
        setPostStatus({ 
          type: 'posting', 
          message: `Posting ${i + 1}/${numberedPosts.length}...` 
        })

        let result: { uri: string; cid: string }

        if (i === 0) {
          // First post - use createPost or createPostWithImages
          if (imageData) {
            result = await interactionsService.createPostWithImages(numberedPosts[i], imageData)
            // Only include images in the first post
            imageData = undefined
          } else {
            result = await interactionsService.createPost(numberedPosts[i])
          }
          lastPost = {
            uri: result.uri,
            cid: result.cid
          }
        } else {
          // Subsequent posts - use createReply or createReplyWithImages
          if (imageData) {
            result = await interactionsService.createReplyWithImages(
              numberedPosts[i],
              {
                root: {
                  uri: lastPost!.uri,
                  cid: lastPost!.cid
                },
                parent: {
                  uri: lastPost!.uri,
                  cid: lastPost!.cid
                }
              },
              imageData
            )
            // Only include images in the first post
            imageData = undefined
          } else {
            result = await interactionsService.createReply(
              numberedPosts[i],
              {
                root: {
                  uri: lastPost!.uri,
                  cid: lastPost!.cid
                },
                parent: {
                  uri: lastPost!.uri,
                  cid: lastPost!.cid
                }
              }
            )
          }
          lastPost = {
            uri: result.uri,
            cid: result.cid
          }
        }

        // Small delay between posts to avoid rate limiting
        if (i < numberedPosts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      setPostStatus({ type: 'success', message: 'Thread posted successfully!' })
      setText('')
      setPosts([])
      setImages([])
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setPostStatus({ type: 'idle' })
      }, 3000)

    } catch (error) {
      console.error('Error posting thread:', error)
      setPostStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to post thread' 
      })
    } finally {
      setIsPosting(false)
    }
  }

  const displayPosts = applyNumbering(posts)

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [])

  return (
    <div className="composer-container">
      <div className="composer-header">
        <h1>Compose Thread</h1>
        <button 
          className="settings-button"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Thread settings"
        >
          <Settings size={20} />
        </button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <h3>Thread Numbering Format</h3>
          <div className="numbering-options">
            {NUMBERING_FORMATS.map(format => (
              <label key={format.id} className="numbering-option">
                <input
                  type="radio"
                  name="numberingFormat"
                  value={format.id}
                  checked={numberingFormat === format.id}
                  onChange={(e) => setNumberingFormat(e.target.value)}
                />
                <span className="format-name">{format.name}</span>
                {format.example && (
                  <span className="format-example">{format.example}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="composer-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind? (Will automatically split into a thread)"
          className="post-textarea"
          disabled={isPosting}
        />
        
        <div className="composer-toolbar">
          <div className="composer-stats">
            <span className="char-count">
              {text.length} characters
            </span>
            {posts.length > 0 && (
              <>
                <span className="separator">•</span>
                <span className="post-count">
                  <Split size={14} />
                  {posts.length} post{posts.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          
          <button
            className="image-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPosting || images.length >= MAX_IMAGES_PER_POST}
            aria-label="Add image"
          >
            <Image size={20} />
            {images.length > 0 && (
              <span className="image-count">{images.length}</span>
            )}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {images.length > 0 && (
        <div className="image-preview-section">
          <h3>Images (will be added to first post)</h3>
          <div className="image-previews">
            {images.map(img => (
              <div key={img.id} className="image-preview">
                <img src={img.preview} alt={img.alt || 'Upload preview'} />
                <button
                  className="remove-image"
                  onClick={() => removeImage(img.id)}
                  aria-label="Remove image"
                >
                  <X size={16} />
                </button>
                <input
                  type="text"
                  placeholder="Alt text (optional)"
                  value={img.alt}
                  onChange={(e) => updateImageAlt(img.id, e.target.value)}
                  className="alt-text-input"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="preview-section">
          <h3>Thread Preview</h3>
          <div className="preview-posts">
            {displayPosts.map((post, index) => (
              <div key={index} className="preview-post">
                <div className="preview-post-header">
                  <span className="preview-post-number">
                    Post {index + 1}
                    {index === 0 && images.length > 0 && (
                      <span className="preview-post-images">
                        <Image size={14} />
                        {images.length}
                      </span>
                    )}
                  </span>
                  <span className="preview-post-length">{post.length}/{MAX_POST_LENGTH}</span>
                </div>
                <div className="preview-post-content">{post}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="composer-actions">
        {postStatus.type !== 'idle' && (
          <div className={`status-message status-${postStatus.type}`}>
            {postStatus.type === 'posting' && <Loader className="status-icon spinning" size={16} />}
            {postStatus.type === 'success' && <CheckCircle className="status-icon" size={16} />}
            {postStatus.type === 'error' && <AlertCircle className="status-icon" size={16} />}
            {postStatus.message}
          </div>
        )}
        
        <button
          className="send-button"
          onClick={handleSend}
          disabled={posts.length === 0 || isPosting}
        >
          <Send size={20} />
          {isPosting ? 'Posting...' : `Post Thread (${posts.length} ${posts.length === 1 ? 'post' : 'posts'})`}
        </button>
      </div>
    </div>
  )
}