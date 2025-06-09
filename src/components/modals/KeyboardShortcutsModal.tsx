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
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
          
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-gray-900 rounded-xl shadow-xl z-50 max-h-[80vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="flex items-center gap-3 text-xl font-semibold">
                <Command size={24} className="text-blue-400" />
                Keyboard Shortcuts
              </h2>
              <button
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {shortcutGroups.map((group) => (
                <div key={group.title} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{group.title}</h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          {shortcut.keys.map((key, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && <span className="text-gray-500 text-sm mx-1">then</span>}
                              <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm font-mono">{key}</kbd>
                            </React.Fragment>
                          ))}
                        </div>
                        <span className="text-gray-300 ml-4">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="px-6 py-3 border-t border-gray-800">
              <p className="text-gray-400 text-sm text-center">
                Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono mx-1">?</kbd> anytime to show these shortcuts
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}