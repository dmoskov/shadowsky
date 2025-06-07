import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Command } from 'lucide-react'

interface ShortcutGroup {
  title: string
  shortcuts: {
    keys: string[]
    description: string
  }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['g', 'h'], description: 'Go to Home' },
      { keys: ['g', 'n'], description: 'Go to Notifications' },
      { keys: ['g', 's'], description: 'Go to Search' },
      { keys: ['g', 'p'], description: 'Go to Profile' },
      { keys: ['Esc'], description: 'Go back / Close modal' }
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['n'], description: 'New post' },
      { keys: ['/'], description: 'Search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' }
    ]
  },
  {
    title: 'Timeline Navigation',
    shortcuts: [
      { keys: ['j'], description: 'Next post' },
      { keys: ['k'], description: 'Previous post' },
      { keys: ['Enter'], description: 'Open focused post' }
    ]
  },
  {
    title: 'Post Actions',
    shortcuts: [
      { keys: ['l'], description: 'Like post' },
      { keys: ['r'], description: 'Reply to post' },
      { keys: ['t'], description: 'Repost' }
    ]
  }
]

export const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleShowShortcuts = () => setIsOpen(true)
    window.addEventListener('showKeyboardShortcuts', handleShowShortcuts)
    
    return () => {
      window.removeEventListener('showKeyboardShortcuts', handleShowShortcuts)
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
          
          <motion.div
            className="keyboard-shortcuts-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                <Command size={24} />
                Keyboard Shortcuts
              </h2>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="shortcuts-content">
              {shortcutGroups.map((group) => (
                <div key={group.title} className="shortcut-group">
                  <h3 className="shortcut-group-title">{group.title}</h3>
                  <div className="shortcut-list">
                    {group.shortcuts.map((shortcut, index) => (
                      <div key={index} className="shortcut-item">
                        <div className="shortcut-keys">
                          {shortcut.keys.map((key, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && <span className="key-separator">then</span>}
                              <kbd className="key">{key}</kbd>
                            </React.Fragment>
                          ))}
                        </div>
                        <span className="shortcut-description">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="modal-footer">
              <p className="text-secondary text-caption">
                Press <kbd>?</kbd> anytime to show these shortcuts
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}