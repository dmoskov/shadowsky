import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Send, Split, Settings, AlertCircle, CheckCircle, Loader, Image, X, Video, Save, Clock, FileText, Trash2, Undo, Smile } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { VideoUploadService } from '../services/atproto/video-upload'
import { GiphySearch } from './GiphySearch'
import { EmojiPicker } from './EmojiPicker'
import { convertGifToMp4, isGifFile } from '../utils/gif-to-video'
import { 
  saveDraft, 
  getDrafts, 
  deleteDraft, 
  generateDraftId,
  getComposerSettings,
  saveComposerSettings,
  type ThreadDraft
} from '../services/drafts'

interface NumberingFormat {
  id: string
  name: string
  format: (index: number, total: number) => string
  example: string
}

interface UploadedMedia {
  id: string
  file: File
  preview: string
  alt: string
  type: 'image' | 'video'
  postIndex?: number // Track which post this attachment belongs to
  order?: number // Track order within a post
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
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_IMAGES_PER_POST = 4
const MAX_VIDEO_LENGTH = 60 // seconds
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mpeg', '.webm', '.mov']

export function Composer() {
  const { agent } = useAuth()
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<string[]>([])
  const [numberingFormat, setNumberingFormat] = useState<'none' | 'simple' | 'brackets' | 'thread' | 'dots'>('simple')
  const [showSettings, setShowSettings] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<{ type: 'idle' | 'posting' | 'success' | 'error', message?: string }>({ type: 'idle' })
  const [media, setMedia] = useState<UploadedMedia[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  
  // Draft and scheduling state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [drafts, setDrafts] = useState<ThreadDraft[]>([])
  const [showDrafts, setShowDrafts] = useState(false)
  const [delaySeconds, setDelaySeconds] = useState(3)
  const [numberingPosition, setNumberingPosition] = useState<'beginning' | 'end'>('end')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [pendingPost, setPendingPost] = useState<{ posts: string[], media: UploadedMedia[] } | null>(null)
  const countdownInterval = useRef<NodeJS.Timeout | null>(null)
  const sendTimeout = useRef<NodeJS.Timeout | null>(null)
  
  // Drag and drop state
  const [draggedMedia, setDraggedMedia] = useState<UploadedMedia | null>(null)
  const [dragOverPostIndex, setDragOverPostIndex] = useState<number | null>(null)
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null)
  
  // Giphy and emoji state
  const [showGiphySearch, setShowGiphySearch] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Load settings on mount
  useEffect(() => {
    const settings = getComposerSettings()
    setNumberingFormat(settings.numberingFormat)
    setShowSettings(settings.showSettingsPanel)
    setDelaySeconds(settings.defaultDelaySeconds)
    setNumberingPosition(settings.numberingPosition || 'end')
  }, [])
  
  // Save settings when they change
  useEffect(() => {
    saveComposerSettings({
      numberingFormat,
      showSettingsPanel: showSettings,
      defaultDelaySeconds: delaySeconds,
      numberingPosition
    })
  }, [numberingFormat, showSettings, delaySeconds, numberingPosition])
  
  // Load drafts
  useEffect(() => {
    setDrafts(getDrafts())
  }, [])
  
  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
      }
      if (sendTimeout.current) {
        clearTimeout(sendTimeout.current)
      }
    }
  }, [])

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
    if (numberingFormat === 'none' || posts.length === 1) return posts
    
    const format = NUMBERING_FORMATS.find(f => f.id === numberingFormat)
    if (!format) return posts

    return posts.map((post, index) => {
      const numbering = format.format(index + 1, posts.length)
      return numberingPosition === 'beginning' ? `${numbering} ${post}` : `${post} ${numbering}`
    })
  }, [numberingFormat, numberingPosition])

  const handleMediaSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Check if we already have a video
    const hasVideo = media.some(m => m.type === 'video')
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/') || 
        SUPPORTED_VIDEO_FORMATS.some(format => file.name.toLowerCase().endsWith(format))
      
      if (!isImage && !isVideo) {
        setPostStatus({ type: 'error', message: `${file.name} is not a supported media file` })
        return false
      }
      
      if (isVideo && hasVideo) {
        setPostStatus({ type: 'error', message: 'Only one video per post is allowed' })
        return false
      }
      
      if (isVideo && media.length > 0) {
        setPostStatus({ type: 'error', message: 'Cannot mix videos with images' })
        return false
      }
      
      if (isImage && hasVideo) {
        setPostStatus({ type: 'error', message: 'Cannot add images when a video is present' })
        return false
      }
      
      if (isImage && file.size > MAX_IMAGE_SIZE && !isGifFile(file)) {
        setPostStatus({ type: 'error', message: `${file.name} is too large (max 1MB for images)` })
        return false
      }
      
      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        setPostStatus({ type: 'error', message: `${file.name} is too large (max 50MB for videos)` })
        return false
      }
      
      return true
    })

    // Process each file, converting GIFs to videos if needed
    for (const file of validFiles) {
      if (isGifFile(file)) {
        try {
          setPostStatus({ type: 'posting', message: 'Converting GIF to video...' })
          
          const videoBlob = await convertGifToMp4(file, (progress) => {
            setPostStatus({ 
              type: 'posting', 
              message: `Converting GIF to video... ${progress}%` 
            })
          })
          
          // Check converted size
          if (videoBlob.size > MAX_VIDEO_SIZE) {
            setPostStatus({ 
              type: 'error', 
              message: `Converted video is too large (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` 
            })
            setTimeout(() => setPostStatus({ type: 'idle' }), 3000)
            continue
          }
          
          const videoFile = new File([videoBlob], file.name.replace('.gif', '.mp4'), { type: 'video/mp4' })
          const newMedia: UploadedMedia = {
            id: Math.random().toString(36).substr(2, 9),
            file: videoFile,
            preview: URL.createObjectURL(videoBlob),
            alt: '',
            type: 'video'
          }
          
          setMedia(prev => [...prev, newMedia])
          setPostStatus({ type: 'success', message: 'GIF converted to video!' })
          setTimeout(() => setPostStatus({ type: 'idle' }), 2000)
        } catch (error) {
          console.error('GIF conversion failed:', error)
          setPostStatus({ type: 'error', message: 'Failed to convert GIF. Using static image.' })
          
          // Fall back to static image
          const newMedia: UploadedMedia = {
            id: Math.random().toString(36).substr(2, 9),
            file,
            preview: URL.createObjectURL(file),
            alt: '',
            type: 'image'
          }
          setMedia(prev => [...prev, newMedia])
        }
      } else {
        // Handle regular images and videos
        const newMedia: UploadedMedia = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: URL.createObjectURL(file),
          alt: '',
          type: file.type.startsWith('video/') ? 'video' : 'image'
        }
        setMedia(prev => [...prev, newMedia])
      }
    }
    
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [media])

  const removeMedia = useCallback((id: string) => {
    setMedia(prev => {
      const removed = prev.find(m => m.id === id)
      if (removed) {
        URL.revokeObjectURL(removed.preview)
      }
      return prev.filter(m => m.id !== id)
    })
  }, [])

  const updateMediaAlt = useCallback((id: string, alt: string) => {
    setMedia(prev => prev.map(m => 
      m.id === id ? { ...m, alt } : m
    ))
  }, [])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, media: UploadedMedia) => {
    setDraggedMedia(media)
    e.dataTransfer.effectAllowed = 'move'
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedMedia(null)
    setDragOverPostIndex(null)
    setDragOverMediaId(null)
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, postIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPostIndex(postIndex)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverPostIndex(null)
    setDragOverMediaId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetPostIndex: number) => {
    e.preventDefault()
    
    if (!draggedMedia) return
    
    // Update the media's post index
    setMedia(prev => prev.map(m => 
      m.id === draggedMedia.id ? { ...m, postIndex: targetPostIndex } : m
    ))
    
    setDraggedMedia(null)
    setDragOverPostIndex(null)
  }, [draggedMedia])

  // Handlers for reordering within a post
  const handleMediaDragOver = useCallback((e: React.DragEvent, targetMedia: UploadedMedia) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedMedia || draggedMedia.id === targetMedia.id) return
    
    // Only allow reordering within the same post
    const draggedPostIndex = draggedMedia.postIndex ?? 0
    const targetPostIndex = targetMedia.postIndex ?? 0
    
    if (draggedPostIndex === targetPostIndex) {
      e.dataTransfer.dropEffect = 'move'
      setDragOverMediaId(targetMedia.id)
    }
  }, [draggedMedia])

  const handleMediaDrop = useCallback((e: React.DragEvent, targetMedia: UploadedMedia) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedMedia || draggedMedia.id === targetMedia.id) return
    
    const draggedPostIndex = draggedMedia.postIndex ?? 0
    const targetPostIndex = targetMedia.postIndex ?? 0
    
    if (draggedPostIndex !== targetPostIndex) return
    
    // Reorder media within the same post
    setMedia(prev => {
      const newMedia = [...prev]
      const draggedIndex = newMedia.findIndex(m => m.id === draggedMedia.id)
      const targetIndex = newMedia.findIndex(m => m.id === targetMedia.id)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Remove dragged item
        const [removed] = newMedia.splice(draggedIndex, 1)
        // Insert at new position
        newMedia.splice(targetIndex, 0, removed)
      }
      
      return newMedia
    })
    
    setDraggedMedia(null)
    setDragOverMediaId(null)
  }, [draggedMedia])

  const saveDraftHandler = useCallback(() => {
    if (!text.trim()) {
      setPostStatus({ type: 'error', message: 'Cannot save empty draft' })
      return
    }
    
    const draft: ThreadDraft = {
      id: currentDraftId || generateDraftId(),
      title: draftTitle || text.substring(0, 50) + '...',
      content: text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: media.map(m => ({
        file: m.preview,
        alt: m.alt
      }))
    }
    
    saveDraft(draft)
    setCurrentDraftId(draft.id)
    setDrafts(getDrafts())
    setPostStatus({ type: 'success', message: 'Draft saved!' })
    
    setTimeout(() => {
      setPostStatus({ type: 'idle' })
    }, 2000)
  }, [text, draftTitle, currentDraftId, media])
  
  const loadDraft = useCallback((draft: ThreadDraft) => {
    setText(draft.content)
    setDraftTitle(draft.title)
    setCurrentDraftId(draft.id)
    setShowDrafts(false)
    
    // TODO: Load images from draft
    // This would require converting the stored URLs back to File objects
    // or storing the images differently
  }, [])
  
  const deleteDraftHandler = useCallback((id: string) => {
    deleteDraft(id)
    setDrafts(getDrafts())
    if (currentDraftId === id) {
      setCurrentDraftId(null)
      setDraftTitle('')
    }
  }, [currentDraftId])
  
  const cancelDelayedSend = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current)
      countdownInterval.current = null
    }
    if (sendTimeout.current) {
      clearTimeout(sendTimeout.current)
      sendTimeout.current = null
    }
    setCountdown(null)
    setPendingPost(null)
    setIsPosting(false)
    setPostStatus({ type: 'idle' })
  }, [])

  const executePost = async (postsToSend?: string[], mediaToSend?: UploadedMedia[]) => {
    if (!agent) {
      console.error('No agent available')
      setPostStatus({ type: 'error', message: 'Not logged in' })
      setIsPosting(false)
      return
    }
    
    // Use passed data or fall back to pendingPost
    const originalPosts = postsToSend || pendingPost?.posts || []
    const originalMedia = mediaToSend || pendingPost?.media || []
    
    if (originalPosts.length === 0) {
      console.error('No posts to send')
      setPostStatus({ type: 'error', message: 'No content to post' })
      setIsPosting(false)
      return
    }
    
    // Clear countdown state
    setCountdown(null)
    
    const numberedPosts = applyNumbering(originalPosts)
    
    try {
      setPostStatus({ type: 'posting', message: 'Creating thread...' })
      
      // Prepare media for each post
      const postMediaMap = new Map<number, Array<{ data: Uint8Array; mimeType: string; alt?: string; type: 'image' | 'video' }>>()
      
      for (const m of originalMedia) {
        const postIndex = m.postIndex ?? 0 // Default to first post if not specified
        if (!postMediaMap.has(postIndex)) {
          postMediaMap.set(postIndex, [])
        }
        
        const mediaData = {
          data: new Uint8Array(await m.file.arrayBuffer()),
          mimeType: m.file.type,
          alt: m.alt,
          type: m.type
        }
        
        postMediaMap.get(postIndex)!.push(mediaData)
      }
      
      let lastPost: { uri: string; cid: string } | undefined

      for (let i = 0; i < numberedPosts.length; i++) {
        setPostStatus({ 
          type: 'posting', 
          message: `Posting ${i + 1}/${numberedPosts.length}...` 
        })

        let result: { uri: string; cid: string }
        const postMedia = postMediaMap.get(i) || []

        // Create base post object
        const postData: any = {
          text: numberedPosts[i]
        }
        
        // Add reply info for subsequent posts
        if (i > 0 && lastPost) {
          postData.reply = {
            root: {
              uri: lastPost.uri,
              cid: lastPost.cid
            },
            parent: {
              uri: lastPost.uri,
              cid: lastPost.cid
            }
          }
        }
        
        // Add media if available for this post
        if (postMedia.length > 0) {
          const videoMedia = postMedia.find(m => m.type === 'video')
          
          if (videoMedia) {
            // Upload video
            setPostStatus({ type: 'posting', message: `Uploading video for post ${i + 1}...` })
            setUploadingVideo(true)
            
            const videoService = new VideoUploadService(agent)
            const videoBlob = await videoService.uploadVideo(
              videoMedia.data,
              videoMedia.mimeType,
              (progress) => {
                setPostStatus({ 
                  type: 'posting', 
                  message: `Uploading video for post ${i + 1}... ${Math.round(progress)}%` 
                })
              }
            )
            
            setUploadingVideo(false)
            
            postData.embed = {
              $type: 'app.bsky.embed.video',
              video: videoBlob.blob,
              aspectRatio: videoBlob.aspectRatio
            }
          } else {
            // Upload images
            const images = await Promise.all(
              postMedia.map(async img => {
                const uploadResult = await agent.uploadBlob(img.data, {
                  encoding: img.mimeType
                })
                return {
                  alt: img.alt || '',
                  image: uploadResult.data.blob
                }
              })
            )
            
            postData.embed = {
              $type: 'app.bsky.embed.images',
              images
            }
          }
        }
        
        result = await agent.post(postData)
        lastPost = {
          uri: result.uri,
          cid: result.cid
        }

        // Small delay between posts to avoid rate limiting
        if (i < numberedPosts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      setPostStatus({ type: 'success', message: 'Thread posted successfully!' })
      
      setText('')
      setPosts([])
      setMedia([])
      setCurrentDraftId(null)
      setDraftTitle('')
      setPendingPost(null)
      setCountdown(null)
      
      // Delete draft if it was loaded
      if (currentDraftId) {
        deleteDraft(currentDraftId)
        setDrafts(getDrafts())
      }
      
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
  
  const handleSend = async () => {
    if (!agent || posts.length === 0) return
    
    setPendingPost({ posts, media })
    setIsPosting(true)
    
    if (delaySeconds > 0) {
      // Start delayed send
      setCountdown(delaySeconds)
      setPostStatus({ 
        type: 'posting', 
        message: `Sending in ${delaySeconds} seconds...` 
      })
      
      // Start countdown
      let timeLeft = delaySeconds
      countdownInterval.current = setInterval(() => {
        timeLeft -= 1
        setCountdown(timeLeft)
        
        if (timeLeft <= 0) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current)
            countdownInterval.current = null
          }
          setPostStatus({ 
            type: 'posting', 
            message: 'Sending now...' 
          })
        } else {
          setPostStatus({ 
            type: 'posting', 
            message: `Sending in ${timeLeft} second${timeLeft !== 1 ? 's' : ''}...` 
          })
        }
      }, 1000)
      
      // Schedule the actual send
      sendTimeout.current = setTimeout(async () => {
        await executePost(posts, media)
      }, delaySeconds * 1000)
    } else {
      // Send immediately (no delay)
      setPostStatus({ type: 'posting', message: 'Creating thread...' })
      await executePost(posts, media)
    }
  }

  const displayPosts = applyNumbering(posts)

  // Handle GIF selection
  const handleSelectGif = useCallback(async (gifUrl: string) => {
    try {
      setPostStatus({ type: 'posting', message: 'Downloading GIF...' })
      
      // Download the GIF with no-cors mode to handle CORS issues
      let response: Response
      let blob: Blob
      
      try {
        // First try with CORS
        response = await fetch(gifUrl)
        blob = await response.blob()
      } catch (corsError) {
        console.log('CORS error, trying with proxy...', corsError)
        
        // If CORS fails, try using a proxy
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(gifUrl)}`
        response = await fetch(proxyUrl)
        blob = await response.blob()
      }
      
      console.log('GIF downloaded, size:', blob.size, 'type:', blob.type)
      
      // Convert GIF to MP4 for animation support
      setPostStatus({ type: 'posting', message: 'Converting GIF to video...' })
      
      let videoBlob: Blob
      let fileName: string
      let mediaType: 'image' | 'video' = 'video'
      
      try {
        // Convert GIF to MP4
        videoBlob = await convertGifToMp4(blob, (progress) => {
          setPostStatus({ 
            type: 'posting', 
            message: `Converting GIF to video... ${progress}%` 
          })
        })
        fileName = 'giphy.mp4'
        
        // Check if converted video is within size limit
        if (videoBlob.size > MAX_VIDEO_SIZE) {
          setPostStatus({ 
            type: 'error', 
            message: `Converted video is too large (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` 
          })
          setTimeout(() => setPostStatus({ type: 'idle' }), 3000)
          return
        }
      } catch (conversionError) {
        console.error('GIF to video conversion failed:', conversionError)
        // Fall back to static image if conversion fails
        setPostStatus({ type: 'posting', message: 'Using static image fallback...' })
        videoBlob = blob
        fileName = 'giphy.gif'
        mediaType = 'image'
        
        // Check original GIF size
        if (blob.size > MAX_IMAGE_SIZE) {
          setPostStatus({ 
            type: 'error', 
            message: `GIF is too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 1MB.` 
          })
          setTimeout(() => setPostStatus({ type: 'idle' }), 3000)
          return
        }
      }
      
      // Create a File object from the blob
      const file = new File([videoBlob], fileName, { 
        type: mediaType === 'video' ? 'video/mp4' : 'image/gif' 
      })
      
      // Add to media
      const newMedia: UploadedMedia = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(videoBlob),
        alt: 'GIF from Giphy',
        type: mediaType
      }
      
      setMedia(prev => [...prev, newMedia])
      setPostStatus({ 
        type: 'success', 
        message: mediaType === 'video' ? 'GIF converted to video!' : 'GIF added!' 
      })
      setTimeout(() => setPostStatus({ type: 'idle' }), 2000)
    } catch (error) {
      console.error('Error adding GIF:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setPostStatus({ type: 'error', message: `Failed to add GIF: ${errorMessage}` })
      setTimeout(() => setPostStatus({ type: 'idle' }), 5000)
    }
  }, [])

  // Handle emoji selection
  const handleSelectEmoji = useCallback((emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      const newText = text.substring(0, start) + emoji + text.substring(end)
      setText(newText)
      
      // Set cursor position after emoji
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(start + emoji.length, start + emoji.length)
        }
      }, 0)
    }
    setShowEmojiPicker(false)
  }, [text])

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      media.forEach(m => URL.revokeObjectURL(m.preview))
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="bsky-card p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm">
            {showSettings ? (
              <>
                <div className="flex items-center gap-2">
                  <label htmlFor="numbering-format" className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>Format:</label>
                  <select
                    id="numbering-format"
                    value={numberingFormat}
                    onChange={(e) => setNumberingFormat(e.target.value as 'none' | 'simple' | 'brackets' | 'thread' | 'dots')}
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      background: 'var(--bsky-bg-secondary)',
                      border: '1px solid var(--bsky-border-primary)',
                      color: 'var(--bsky-text-primary)',
                      outline: 'none'
                    }}
                  >
                    {NUMBERING_FORMATS.map(format => (
                      <option key={format.id} value={format.id}>
                        {format.name} {format.example && `(${format.example})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label htmlFor="numbering-position" className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>Position:</label>
                  <select
                    id="numbering-position"
                    value={numberingPosition}
                    onChange={(e) => setNumberingPosition(e.target.value as 'beginning' | 'end')}
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      background: 'var(--bsky-bg-secondary)',
                      border: '1px solid var(--bsky-border-primary)',
                      color: 'var(--bsky-text-primary)',
                      outline: 'none'
                    }}
                  >
                    <option value="beginning">Beginning</option>
                    <option value="end">End</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label htmlFor="send-delay" className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>Delay:</label>
                  <input
                    id="send-delay"
                    type="number"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                    min="0"
                    max="300"
                    className="w-16 px-2 py-1 rounded text-center text-sm"
                    style={{ 
                      background: 'var(--bsky-bg-secondary)',
                      border: '1px solid var(--bsky-border-primary)',
                      color: 'var(--bsky-text-primary)'
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>sec</span>
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                {numberingFormat !== 'none' && `${NUMBERING_FORMATS.find(f => f.id === numberingFormat)?.name} • `}
                {numberingPosition === 'beginning' ? 'Start' : 'End'} • 
                {delaySeconds > 0 ? ` ${delaySeconds}s delay` : ' Instant'}
              </span>
            )}
          </div>
          
          <button 
            className="bsky-button-secondary p-1.5"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Toggle settings"
          >
            <Settings size={16} />
          </button>
        </div>
        
        <div className="flex justify-end mb-4">
          <button
            className="bsky-button-primary flex items-center gap-2 px-6 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={posts.length === 0 || isPosting}
          >
            <Send size={20} />
            {isPosting && countdown ? `Sending in ${countdown}s...` : isPosting ? 'Posting...' : (posts.length > 1 ? `Post Thread (${posts.length} posts)` : 'Post')}
          </button>
        </div>
        
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[200px] p-4 rounded-lg resize-vertical font-inherit transition-all"
          style={{ 
            background: 'var(--bsky-bg-secondary)',
            border: '1px solid var(--bsky-border-primary)',
            color: 'var(--bsky-text-primary)',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
          disabled={isPosting}
        />
        
        <div className="flex items-center gap-2 mt-3 mb-3">
          <input
            type="text"
            placeholder="Draft title (optional)"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="flex-1 p-2 rounded-lg text-sm"
            style={{ 
              background: 'var(--bsky-bg-secondary)',
              border: '1px solid var(--bsky-border-primary)',
              color: 'var(--bsky-text-primary)',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
          />
          {currentDraftId && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ 
              background: 'var(--bsky-bg-tertiary)', 
              color: 'var(--bsky-text-secondary)' 
            }}>
              Editing draft
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 text-sm">
            <span style={{ color: 'var(--bsky-text-secondary)' }}>
              {text.length} characters
            </span>
            {posts.length > 1 && (
              <>
                <span style={{ color: 'var(--bsky-text-tertiary)' }}>•</span>
                <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--bsky-primary)' }}>
                  <Split size={14} />
                  {posts.length} posts
                </span>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <div className="relative group">
              <button
                className="bsky-button-secondary flex items-center gap-2 relative"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*'
                    fileInputRef.current.multiple = true
                    fileInputRef.current.click()
                  }
                }}
                disabled={isPosting || media.length >= MAX_IMAGES_PER_POST || media.some(m => m.type === 'video') || uploadingVideo}
                aria-label="Add images"
              >
                <Image size={20} />
                {media.filter(m => m.type === 'image').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-medium" style={{ background: 'var(--bsky-primary)' }}>
                    {media.filter(m => m.type === 'image').length}
                  </span>
                )}
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                  <div className="font-semibold mb-1">Add Images</div>
                  <div>Up to 4 images, max 1MB each</div>
                  <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <button
                className="bsky-button-secondary flex items-center gap-2 relative"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*,.mp4,.mpeg,.webm,.mov'
                    fileInputRef.current.multiple = false
                    fileInputRef.current.click()
                  }
                }}
                disabled={isPosting || media.length > 0 || uploadingVideo}
                aria-label="Add video"
              >
                <Video size={20} />
                {media.some(m => m.type === 'video') && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-medium" style={{ background: 'var(--bsky-primary)' }}>
                    1
                  </span>
                )}
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                  <div className="font-semibold mb-1">Add Video</div>
                  <div>1 video per post, max 50MB, 60 sec</div>
                  <div className="mt-1 text-gray-300">Processed on Bluesky servers</div>
                  <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <button
                className="bsky-button-secondary flex items-center gap-2"
                onClick={() => setShowGiphySearch(true)}
                disabled={isPosting || media.length >= MAX_IMAGES_PER_POST || media.some(m => m.type === 'video')}
                aria-label="Search GIFs"
              >
                <span className="font-bold text-sm">GIF</span>
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                  <div className="font-semibold mb-1">Search GIFs</div>
                  <div>Powered by GIPHY</div>
                  <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <button
                className="bsky-button-secondary flex items-center gap-2"
                onClick={() => setShowEmojiPicker(true)}
                disabled={isPosting}
                aria-label="Add emoji"
              >
                <Smile size={20} />
              </button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                  <div className="font-semibold mb-1">Add Emoji</div>
                  <div>Insert emoji at cursor</div>
                  <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleMediaSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {media.length > 0 && (
        <div className="bsky-card p-4 md:p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--bsky-text-primary)' }}>
            {media.some(m => m.type === 'video') ? 'Video' : 'Images'} 
            <span className="text-sm font-normal" style={{ color: 'var(--bsky-text-secondary)' }}>
              {posts.length > 1 ? '(drag to reorder or assign to posts)' : media.length > 1 ? '(drag to reorder)' : '(will be added to first post)'}
            </span>
          </h3>
          {media.some(m => m.type === 'video') && (
            <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ background: 'var(--bsky-bg-tertiary)' }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--bsky-text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                Videos will be uploaded to Bluesky's servers for processing. This may take a few moments depending on file size and server load.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {media.filter(m => m.postIndex === undefined || m.postIndex === 0).map(m => (
              <div 
                key={m.id} 
                className={`relative rounded-lg overflow-hidden border cursor-move ${dragOverMediaId === m.id ? 'ring-2 ring-blue-400' : ''}`}
                style={{ 
                  borderColor: dragOverMediaId === m.id ? 'var(--bsky-primary)' : 'var(--bsky-border-primary)', 
                  background: 'var(--bsky-bg-secondary)',
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, m)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleMediaDragOver(e, m)}
                onDrop={(e) => handleMediaDrop(e, m)}
                onDragLeave={() => setDragOverMediaId(null)}
              >
                {m.type === 'video' ? (
                  <video 
                    src={m.preview} 
                    controls 
                    className="w-full h-32 object-cover pointer-events-none"
                  />
                ) : (
                  <img src={m.preview} alt={m.alt || 'Upload preview'} className="w-full h-32 object-cover pointer-events-none" />
                )}
                <button
                  className="absolute top-2 right-2 p-1 rounded-full bg-black bg-opacity-70 text-white hover:bg-opacity-90 transition-all"
                  onClick={() => removeMedia(m.id)}
                  aria-label="Remove media"
                >
                  <X size={16} />
                </button>
                <div className="absolute top-2 left-2 p-1 rounded-full bg-black bg-opacity-70 text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 11V7a5 5 0 0110 0v4m-5-4v10m-4-6h8" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Alt text (optional)"
                  value={m.alt}
                  onChange={(e) => updateMediaAlt(m.id, e.target.value)}
                  className="w-full p-2 text-sm border-t focus:outline-none"
                  style={{ borderColor: 'var(--bsky-border-primary)', background: 'var(--bsky-bg-primary)', color: 'var(--bsky-text-primary)' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mb-6">
          {posts.length > 1 && (
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--bsky-text-primary)' }}>Thread Preview</h3>
          )}
          <div className="space-y-3">
            {displayPosts.map((post, index) => {
              const postMedia = media.filter(m => m.postIndex === index)
              const hasMedia = postMedia.length > 0 || (index === 0 && media.filter(m => m.postIndex === undefined).length > 0)
              
              return (
                <div 
                  key={index} 
                  className={`bsky-card p-4 hover:shadow-sm transition-all relative ${dragOverPostIndex === index ? 'ring-2 ring-blue-400' : ''}`}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {dragOverPostIndex === index && (
                    <div className="absolute inset-0 bg-blue-50 bg-opacity-50 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="text-blue-600 font-medium">Drop attachment here</div>
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-3">
                    <span className="flex items-center gap-2">
                      {posts.length > 1 && (
                        <span className="font-semibold" style={{ color: 'var(--bsky-primary)' }}>
                          Post {index + 1}
                        </span>
                      )}
                      {hasMedia && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bsky-bg-secondary)', color: 'var(--bsky-text-secondary)' }}>
                          {media.some(m => m.type === 'video' && (m.postIndex === index || (index === 0 && m.postIndex === undefined))) ? <Video size={12} /> : <Image size={12} />}
                          {index === 0 ? media.filter(m => m.postIndex === undefined || m.postIndex === 0).length : postMedia.length}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-mono" style={{ color: 'var(--bsky-text-tertiary)' }}>{post.length}/{MAX_POST_LENGTH}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words mb-3" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>{post}</div>
                  
                  {/* Show attachments for this post */}
                  {(index === 0 ? media.filter(m => m.postIndex === undefined || m.postIndex === 0) : postMedia).length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--bsky-border-primary)' }}>
                      {(index === 0 ? media.filter(m => m.postIndex === undefined || m.postIndex === 0) : postMedia).map(m => (
                        <div 
                          key={m.id}
                          className={`relative rounded overflow-hidden border cursor-move ${dragOverMediaId === m.id ? 'ring-2 ring-blue-400' : ''}`}
                          style={{ 
                            borderColor: dragOverMediaId === m.id ? 'var(--bsky-primary)' : 'var(--bsky-border-primary)', 
                            background: 'var(--bsky-bg-secondary)',
                            transition: 'border-color 0.2s'
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, m)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleMediaDragOver(e, m)}
                          onDrop={(e) => handleMediaDrop(e, m)}
                          onDragLeave={() => setDragOverMediaId(null)}
                        >
                          {m.type === 'video' ? (
                            <video src={m.preview} className="w-full h-16 object-cover pointer-events-none" />
                          ) : (
                            <img src={m.preview} alt={m.alt || 'Attachment'} className="w-full h-16 object-cover pointer-events-none" />
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="opacity-0 hover:opacity-100">
                              <path d="M7 11V7a5 5 0 0110 0v4m-5-4v10m-4-6h8" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showDrafts && (
        <div className="bsky-card p-4 md:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              Saved Drafts
            </h3>
            <button 
              className="bsky-button-secondary p-2"
              onClick={() => {
                setShowDrafts(false)
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          {showDrafts && (
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--bsky-text-secondary)' }}>No saved drafts</p>
              ) : (
                drafts.map(draft => (
                  <div key={draft.id} className="p-4 rounded-lg border hover:shadow-sm transition-all cursor-pointer" style={{ borderColor: 'var(--bsky-border-primary)', background: 'var(--bsky-bg-secondary)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium" style={{ color: 'var(--bsky-text-primary)' }}>{draft.title}</h4>
                      <button
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteDraftHandler(draft.id)
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                      {draft.content}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        Updated {new Date(draft.updatedAt).toLocaleString()}
                      </span>
                      <button
                        className="bsky-button-secondary text-sm px-3 py-1"
                        onClick={() => loadDraft(draft)}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-col gap-4 items-end">
        {postStatus.type !== 'idle' && (
          <div className={`w-full flex items-center gap-3 p-4 rounded-lg border ${
            postStatus.type === 'posting' ? 'bg-blue-50 border-blue-200' :
            postStatus.type === 'success' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}>
            {postStatus.type === 'posting' && <Loader className="animate-spin text-blue-600" size={16} />}
            {postStatus.type === 'success' && <CheckCircle className="text-green-600" size={16} />}
            {postStatus.type === 'error' && <AlertCircle className="text-red-600" size={16} />}
            <span className={`flex-1 text-sm ${
              postStatus.type === 'posting' ? 'text-blue-700' :
              postStatus.type === 'success' ? 'text-green-700' :
              'text-red-700'
            }`}>{postStatus.message}</span>
            {postStatus.type === 'posting' && countdown && (
              <button
                className="flex items-center gap-1 px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={cancelDelayedSend}
              >
                <Undo size={14} />
                Undo
              </button>
            )}
          </div>
        )}
        
        <div className="flex gap-3 flex-wrap justify-end">
          {currentDraftId && (
            <button
              className="bsky-button-secondary flex items-center gap-2"
              onClick={() => {
                // Clear everything to start a new draft
                setText('')
                setPosts([])
                // Clean up media previews
                media.forEach(m => URL.revokeObjectURL(m.preview))
                setMedia([])
                setCurrentDraftId(null)
                setDraftTitle('')
                setPostStatus({ type: 'success', message: 'Ready for new draft' })
                setTimeout(() => setPostStatus({ type: 'idle' }), 2000)
              }}
            >
              <FileText size={16} />
              New Draft
            </button>
          )}
          
          <button
            className="bsky-button-secondary flex items-center gap-2"
            onClick={saveDraftHandler}
            disabled={!text.trim()}
          >
            <Save size={16} />
            {currentDraftId ? 'Update Draft' : 'Save Draft'}
          </button>
          
          <button
            className="bsky-button-secondary flex items-center gap-2"
            onClick={() => setShowDrafts(!showDrafts)}
          >
            <FileText size={16} />
            Drafts ({drafts.length})
          </button>
        </div>
      </div>
      
      {showGiphySearch && (
        <GiphySearch 
          onSelectGif={handleSelectGif}
          onClose={() => setShowGiphySearch(false)}
        />
      )}
      
      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  )
}