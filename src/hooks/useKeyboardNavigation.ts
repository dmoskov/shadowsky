import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface KeyboardShortcuts {
  [key: string]: {
    handler: () => void
    description: string
    preventDefault?: boolean
  }
}

export function useKeyboardNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const shortcuts: KeyboardShortcuts = {
    // Navigation shortcuts
    'g h': {
      handler: () => navigate('/'),
      description: 'Go to Home'
    },
    'g n': {
      handler: () => navigate('/notifications'),
      description: 'Go to Notifications'
    },
    'g s': {
      handler: () => navigate('/search'),
      description: 'Go to Search'
    },
    'g p': {
      handler: () => {
        // Navigate to own profile - would need auth context
        const handle = sessionStorage.getItem('userHandle')
        if (handle) navigate(`/profile/${handle}`)
      },
      description: 'Go to Profile'
    },
    
    // Action shortcuts
    'n': {
      handler: () => {
        // Trigger compose modal
        document.querySelector<HTMLButtonElement>('.compose-fab')?.click()
      },
      description: 'New post',
      preventDefault: true
    },
    '/': {
      handler: () => {
        // Focus search if on search page, otherwise navigate to search
        if (location.pathname === '/search') {
          document.querySelector<HTMLInputElement>('.search-input')?.focus()
        } else {
          navigate('/search')
        }
      },
      description: 'Search',
      preventDefault: true
    },
    '?': {
      handler: () => {
        // Show keyboard shortcuts modal
        const event = new CustomEvent('showKeyboardShortcuts')
        window.dispatchEvent(event)
      },
      description: 'Show keyboard shortcuts'
    },
    
    // Post navigation (when focused)
    'j': {
      handler: () => navigatePost('next'),
      description: 'Next post'
    },
    'k': {
      handler: () => navigatePost('prev'),
      description: 'Previous post'
    },
    'Enter': {
      handler: () => openFocusedPost(),
      description: 'Open post'
    },
    'l': {
      handler: () => likeFocusedPost(),
      description: 'Like post'
    },
    'r': {
      handler: () => replyToFocusedPost(),
      description: 'Reply to post'
    },
    't': {
      handler: () => repostFocusedPost(),
      description: 'Repost'
    }
  }

  // Track key sequence for multi-key shortcuts
  let keySequence = ''
  let sequenceTimer: NodeJS.Timeout | null = null

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).contentEditable === 'true'
    ) {
      return
    }

    // Build key combination
    const key = e.key.toLowerCase()
    const modifiers = []
    if (e.ctrlKey) modifiers.push('ctrl')
    if (e.altKey) modifiers.push('alt')
    if (e.shiftKey) modifiers.push('shift')
    if (e.metaKey) modifiers.push('cmd')
    
    const combo = modifiers.length > 0 
      ? `${modifiers.join('+')}+${key}`
      : key

    // Handle multi-key sequences
    if (sequenceTimer) {
      clearTimeout(sequenceTimer)
    }
    
    keySequence = keySequence ? `${keySequence} ${combo}` : combo
    
    // Check if this matches any shortcut
    const shortcut = shortcuts[keySequence]
    if (shortcut) {
      if (shortcut.preventDefault) {
        e.preventDefault()
      }
      shortcut.handler()
      keySequence = ''
      return
    }
    
    // Reset sequence after a delay
    sequenceTimer = setTimeout(() => {
      keySequence = ''
    }, 1000)
  }, [location.pathname])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (sequenceTimer) clearTimeout(sequenceTimer)
    }
  }, [handleKeyDown])

  return { shortcuts }
}

// Helper functions for post navigation
function navigatePost(direction: 'next' | 'prev') {
  const posts = Array.from(document.querySelectorAll('.post-card'))
  const focused = document.querySelector('.post-card.focused')
  
  let index = focused ? posts.indexOf(focused) : -1
  
  if (direction === 'next') {
    index = Math.min(index + 1, posts.length - 1)
  } else {
    index = Math.max(index - 1, 0)
  }
  
  // Remove previous focus
  posts.forEach(post => post.classList.remove('focused'))
  
  // Add focus to new post
  if (posts[index]) {
    posts[index].classList.add('focused')
    posts[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function openFocusedPost() {
  const focused = document.querySelector('.post-card.focused')
  if (focused) {
    (focused as HTMLElement).click()
  }
}

function likeFocusedPost() {
  const focused = document.querySelector('.post-card.focused')
  if (focused) {
    const likeBtn = focused.querySelector('.like-btn')
    if (likeBtn) (likeBtn as HTMLElement).click()
  }
}

function replyToFocusedPost() {
  const focused = document.querySelector('.post-card.focused')
  if (focused) {
    const replyBtn = focused.querySelector('.engagement-btn:first-child')
    if (replyBtn) (replyBtn as HTMLElement).click()
  }
}

function repostFocusedPost() {
  const focused = document.querySelector('.post-card.focused')
  if (focused) {
    const repostBtn = focused.querySelector('.engagement-btn:nth-child(2)')
    if (repostBtn) (repostBtn as HTMLElement).click()
  }
}