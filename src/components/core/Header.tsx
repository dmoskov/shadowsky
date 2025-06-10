import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, 
  Search, 
  LogOut, 
  User, 
  Settings, 
  Bookmark,
  Moon,
  Sun,
  ChevronDown,
  Palette
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadNotificationCount } from '../../hooks/useNotifications'
import { useToast } from '../ui/Toast'
import { useTheme, useThemeClasses } from '../../contexts/ThemeContext'

interface HeaderProps {
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { logout, session } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [darkMode, setDarkMode] = useState(true) // For now, always dark
  const [searchQuery, setSearchQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const navigate = useNavigate()
  const { data: unreadCount } = useUnreadNotificationCount()
  const toast = useToast()
  const { isProtestTheme, toggleTheme } = useTheme()
  const themeClasses = useThemeClasses()

  // Handle scroll behavior
  useEffect(() => {
    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          
          // Add scrolled class when scrolled down
          setIsScrolled(currentScrollY > 10)
          
          // Hide header when scrolling down, show when scrolling up
          if (currentScrollY > lastScrollY && currentScrollY > 60) {
            setIsHidden(true)
          } else {
            setIsHidden(false)
          }
          
          lastScrollY = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    // TODO: Implement theme switching
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

  return (
    <motion.header 
      className={`
        fixed top-0 left-0 right-0 z-50
        ${themeClasses.primaryBg} ${themeClasses.border} ${themeClasses.headerEffects}
        transition-all duration-300
        ${isScrolled ? 'shadow-lg backdrop-blur-md bg-opacity-95' : ''}
        ${isHidden ? '-translate-y-full' : 'translate-y-0'}
        ${isProtestTheme ? 'border-b-2 border-orange-500' : ''}
      `}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile Menu Toggle */}
          <motion.button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={onMenuToggle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Menu"
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className="w-full h-0.5 bg-gray-300 rounded-full transition-all"></span>
              <span className="w-full h-0.5 bg-gray-300 rounded-full transition-all"></span>
              <span className="w-full h-0.5 bg-gray-300 rounded-full transition-all"></span>
            </div>
          </motion.button>

          {/* Logo */}
          <div className="flex-shrink-0">
            <motion.h1 
              className={`text-2xl font-bold cursor-pointer ${
                isProtestTheme 
                  ? 'text-graffiti text-red-600' 
                  : 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'
              }`}
              onClick={() => navigate('/')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isProtestTheme ? 'RESISTANCE' : 'Bluesky'}
            </motion.h1>
          </div>

          {/* Search Bar */}
          <form 
            className="hidden md:flex flex-1 max-w-md mx-8" 
            onSubmit={handleSearch}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isProtestTheme ? "SEARCH THE TRUTH..." : "Search Bluesky..."} 
                className={`w-full pl-10 pr-4 py-2 rounded-full transition-all duration-200 ${
                  isProtestTheme 
                    ? `${themeClasses.inputEffects} bg-gray-800 border-orange-500 text-white placeholder-yellow-400`
                    : 'bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20'
                }`}
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Search Button (Mobile) */}
            <motion.button
              className="md:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={() => navigate('/search')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Search"
            >
              <Search className="text-gray-300" size={20} />
            </motion.button>

            {/* Theme Toggle */}
            <motion.button
              className={`p-2 rounded-lg transition-colors ${
                isProtestTheme 
                  ? 'hover:bg-red-800 text-red-400' 
                  : 'hover:bg-gray-800 text-gray-300'
              }`}
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={isProtestTheme ? "Switch to default theme" : "Switch to resistance theme"}
            >
              {isProtestTheme ? 
                <span className="text-xs font-bold">✊</span> : 
                <Palette size={20} />
              }
            </motion.button>

            {/* Notifications */}
            <motion.button
              className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={() => navigate('/notifications')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Notifications"
            >
              <Bell className="text-gray-300" size={20} />
              {unreadCount !== undefined && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs 
                               rounded-full h-5 w-5 flex items-center justify-center font-medium">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </motion.button>

            {/* User Menu */}
            <div className="relative">
              <motion.button
                className={`
                  flex items-center space-x-2 p-1.5 pr-3 rounded-full
                  hover:bg-gray-800 transition-colors
                  ${showDropdown ? 'bg-gray-800' : ''}
                `}
                onClick={() => setShowDropdown(!showDropdown)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 
                               flex items-center justify-center text-white font-medium">
                  {session?.handle?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:block text-gray-300 text-sm font-medium">
                  @{session?.handle || 'user'}
                </span>
                <motion.div
                  animate={{ rotate: showDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="text-gray-400" size={16} />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl 
                              border border-gray-700 overflow-hidden"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button 
                      className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-700 
                                transition-colors text-gray-200"
                      onClick={() => {
                        navigate(`/profile/${session?.handle}`)
                        setShowDropdown(false)
                      }}
                    >
                      <User size={18} />
                      <span>Profile</span>
                    </button>
                    <button 
                      className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-700 
                                transition-colors text-gray-200"
                      onClick={() => {
                        toast.info('Bookmarks feature coming soon!')
                        setShowDropdown(false)
                      }}
                    >
                      <Bookmark size={18} />
                      <span>Bookmarks</span>
                    </button>
                    <button 
                      className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-700 
                                transition-colors text-gray-200"
                      onClick={() => {
                        navigate('/settings')
                        setShowDropdown(false)
                      }}
                    >
                      <Settings size={18} />
                      <span>Settings</span>
                    </button>
                    <div className="border-t border-gray-700" />
                    <button 
                      className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-red-900 
                                hover:bg-opacity-20 transition-colors text-red-400"
                      onClick={logout}
                    >
                      <LogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}