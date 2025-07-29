import React, { useState, useCallback, useEffect } from 'react'
import { Send, Split, Settings, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getInteractionsService } from '@bsky/shared'

interface NumberingFormat {
  id: string
  name: string
  format: (index: number, total: number) => string
  example: string
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

export function Composer() {
  const { agent } = useAuth()
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<string[]>([])
  const [numberingFormat, setNumberingFormat] = useState('simple')
  const [showSettings, setShowSettings] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<{ type: 'idle' | 'posting' | 'success' | 'error', message?: string }>({ type: 'idle' })

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

  const handleSend = async () => {
    if (!agent || posts.length === 0) return

    setIsPosting(true)
    setPostStatus({ type: 'posting', message: 'Creating thread...' })

    try {
      const interactionsService = getInteractionsService(agent)
      const numberedPosts = applyNumbering(posts)
      
      let lastPost: { uri: string; cid: string } | undefined

      for (let i = 0; i < numberedPosts.length; i++) {
        setPostStatus({ 
          type: 'posting', 
          message: `Posting ${i + 1}/${numberedPosts.length}...` 
        })

        let result: { uri: string; cid: string }

        if (i === 0) {
          // First post - use createPost
          result = await interactionsService.createPost(numberedPosts[i])
          lastPost = {
            uri: result.uri,
            cid: result.cid
          }
        } else {
          // Subsequent posts - use createReply
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
      </div>

      {posts.length > 0 && (
        <div className="preview-section">
          <h3>Thread Preview</h3>
          <div className="preview-posts">
            {displayPosts.map((post, index) => (
              <div key={index} className="preview-post">
                <div className="preview-post-header">
                  <span className="preview-post-number">Post {index + 1}</span>
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