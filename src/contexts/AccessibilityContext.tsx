import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AccessibilitySettings {
  // Visual preferences
  highContrast: boolean
  colorblindMode: boolean
  reducedMotion: boolean
  fontSize: 'normal' | 'large' | 'extra-large'
  
  // Screen reader preferences
  screenReaderAnnouncements: boolean
  verboseMode: boolean
  
  // Keyboard navigation
  keyboardShortcuts: boolean
  focusIndicators: 'default' | 'enhanced'
}

interface AccessibilityContextType {
  settings: AccessibilitySettings
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void
  resetSettings: () => void
  announce: (message: string, priority?: 'polite' | 'assertive') => void
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  colorblindMode: false,
  reducedMotion: false,
  fontSize: 'normal',
  screenReaderAnnouncements: true,
  verboseMode: false,
  keyboardShortcuts: true,
  focusIndicators: 'default',
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null)

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('a11y-settings')
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) }
      } catch {
        return defaultSettings
      }
    }
    
    // Check system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
    
    return {
      ...defaultSettings,
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
    }
  })
  
  // Live region for screen reader announcements
  const [announcements, setAnnouncements] = useState<Array<{
    id: string
    message: string
    priority: 'polite' | 'assertive'
  }>>([])
  
  // Update document attributes based on settings
  useEffect(() => {
    const root = document.documentElement
    
    // High contrast mode
    root.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal')
    
    // Colorblind mode
    root.setAttribute('data-colorblind', settings.colorblindMode ? 'true' : 'false')
    
    // Font size
    root.setAttribute('data-font-size', settings.fontSize)
    
    // Reduced motion
    root.setAttribute('data-reduced-motion', settings.reducedMotion ? 'true' : 'false')
    
    // Enhanced focus indicators
    root.setAttribute('data-focus-indicators', settings.focusIndicators)
    
    // Save to localStorage
    localStorage.setItem('a11y-settings', JSON.stringify(settings))
  }, [settings])
  
  // Listen for system preference changes
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      updateSetting('reducedMotion', e.matches)
    }
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      updateSetting('highContrast', e.matches)
    }
    
    motionQuery.addEventListener('change', handleMotionChange)
    contrastQuery.addEventListener('change', handleContrastChange)
    
    return () => {
      motionQuery.removeEventListener('change', handleMotionChange)
      contrastQuery.removeEventListener('change', handleContrastChange)
    }
  }, [])
  
  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }
  
  const resetSettings = () => {
    setSettings(defaultSettings)
    localStorage.removeItem('a11y-settings')
  }
  
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.screenReaderAnnouncements) return
    
    const id = Date.now().toString()
    setAnnouncements(prev => [...prev, { id, message, priority }])
    
    // Remove announcement after 1 second to clear the live region
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    }, 1000)
  }
  
  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings, announce }}>
      {children}
      
      {/* Live regions for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcements
          .filter(a => a.priority === 'polite')
          .map(a => a.message)
          .join('. ')}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcements
          .filter(a => a.priority === 'assertive')
          .map(a => a.message)
          .join('. ')}
      </div>
    </AccessibilityContext.Provider>
  )
}

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}

// Utility hook for keyboard navigation
export const useKeyboardNavigation = () => {
  const { settings } = useAccessibility()
  
  const handleKeyDown = (e: React.KeyboardEvent, handlers: Record<string, () => void>) => {
    if (!settings.keyboardShortcuts) return
    
    const key = e.key.toLowerCase()
    const modifiers = {
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      alt: e.altKey,
      shift: e.shiftKey,
    }
    
    // Build key combination string
    let combo = ''
    if (modifiers.ctrl || modifiers.meta) combo += 'cmd+'
    if (modifiers.alt) combo += 'alt+'
    if (modifiers.shift) combo += 'shift+'
    combo += key
    
    if (handlers[combo]) {
      e.preventDefault()
      handlers[combo]()
    }
  }
  
  return { handleKeyDown }
}

// Font size utilities
export const getFontSizeMultiplier = (size: AccessibilitySettings['fontSize']) => {
  switch (size) {
    case 'large': return 1.125
    case 'extra-large': return 1.25
    default: return 1
  }
}