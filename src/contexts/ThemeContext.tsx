import React, { createContext, useContext, useState, useEffect } from 'react'

export type ThemeType = 'default' | 'protest'

interface ThemeContextType {
  theme: ThemeType
  setTheme: (theme: ThemeType) => void
  toggleTheme: () => void
  isProtestTheme: boolean
  themeConfig: {
    name: string
    description: string
    features: string[]
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

const THEME_STORAGE_KEY = 'bluesky-theme'

const themeConfigs = {
  default: {
    name: 'Default',
    description: 'Clean, modern interface optimized for readability',
    features: ['Dark theme', 'Accessible contrast', 'Minimal design']
  },
  protest: {
    name: 'Digital Resistance',
    description: 'Bold protest-inspired theme for digital activism',
    features: [
      'Street art aesthetic',
      'Resistance UI elements', 
      'Solidarity interactions',
      'Emergency broadcast mode',
      'Anonymity features'
    ]
  }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>('default')

  // Load saved theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType
    if (savedTheme && (savedTheme === 'default' || savedTheme === 'protest')) {
      setThemeState(savedTheme)
    }
  }, [])

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    
    // Analytics event for theme switching
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-ignore
      window.gtag('event', 'theme_change', {
        theme_name: newTheme,
        previous_theme: theme
      })
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'default' ? 'protest' : 'default')
  }

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isProtestTheme: theme === 'protest',
    themeConfig: themeConfigs[theme]
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Theme-aware hooks for components
export const useThemeClasses = () => {
  const { theme } = useTheme()
  
  return {
    // Background classes
    primaryBg: theme === 'protest' ? 'bg-protest-primary' : 'bg-gray-900',
    secondaryBg: theme === 'protest' ? 'bg-protest-secondary' : 'bg-gray-800', 
    cardBg: theme === 'protest' ? 'bg-protest-card text-gray-900' : 'bg-gray-800 text-gray-100',
    
    // Text classes
    primaryText: theme === 'protest' ? 'text-gray-900' : 'text-gray-100',
    secondaryText: theme === 'protest' ? 'text-gray-600' : 'text-gray-400',
    accentText: theme === 'protest' ? 'text-red-600' : 'text-blue-400',
    
    // Border classes
    border: theme === 'protest' ? 'border-orange-500' : 'border-gray-700',
    borderFocus: theme === 'protest' ? 'focus:border-red-500' : 'focus:border-blue-500',
    
    // Button classes
    primaryBtn: theme === 'protest' 
      ? 'btn-solidarity' 
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    secondaryBtn: theme === 'protest'
      ? 'bg-gray-700 hover:bg-gray-600 text-gray-100 border border-orange-500'
      : 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    
    // Special effects
    cardEffects: theme === 'protest' 
      ? 'torn-edge poster-shadow wheat-paste handprint-bg' 
      : '',
    inputEffects: theme === 'protest' 
      ? 'spray-border' 
      : '',
    linkEffects: theme === 'protest' 
      ? 'link-protest' 
      : 'text-blue-400 hover:text-blue-300',
    headerEffects: theme === 'protest'
      ? 'protest-header'
      : ''
  }
}

// Protest-specific feature hooks
export const useProtestFeatures = () => {
  const { isProtestTheme } = useTheme()
  
  return {
    // Resistance mode toggle
    useResistanceMode: () => {
      const [isResistanceMode, setIsResistanceMode] = useState(false)
      
      return {
        isResistanceMode: isProtestTheme && isResistanceMode,
        toggleResistanceMode: () => setIsResistanceMode(!isResistanceMode),
        resistanceClasses: isResistanceMode 
          ? 'blur-sm hover:blur-none transition-all duration-300' 
          : ''
      }
    },
    
    // Solidarity reactions
    solidarityReactions: ['✊', '🚫', '❤️', '📢', '🏴'],
    
    // Emergency broadcast mode
    emergencyMode: {
      isEnabled: isProtestTheme,
      alertClasses: 'emergency-alert',
      broadcastText: 'URGENT BROADCAST'
    },
    
    // Timeline filters for protest theme
    protestFilters: [
      { id: 'frontline', name: 'Frontline', icon: '🚨' },
      { id: 'mutual-aid', name: 'Mutual Aid', icon: '🤝' },
      { id: 'actions', name: 'Actions', icon: '📢' },
      { id: 'stories', name: 'Stories', icon: '📝' }
    ]
  }
}

export default ThemeContext