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
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadNotificationCount } from '../../hooks/useNotifications'
import clsx from 'clsx'

export const Header: React.FC = () => {
  const { logout, session } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [darkMode, setDarkMode] = useState(true) // For now, always dark
  const [searchQuery, setSearchQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const navigate = useNavigate()
  const { data: unreadCount } = useUnreadNotificationCount()

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
      className={clsx('header', {
        'scrolled': isScrolled,
        'hidden': isHidden
      })}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="header-content">
        {/* Logo */}
        <div className="header-logo" onClick={() => navigate('/')}>
          <motion.h1 
            className="gradient-text text-h3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ cursor: 'pointer' }}
          >
            Bluesky
          </motion.h1>
        </div>

        {/* Search Bar */}
        <form className="header-search" onSubmit={handleSearch}>
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Bluesky..." 
            className="search-input"
          />
        </form>

        {/* Actions */}
        <div className="header-actions">
          {/* Search Button (Mobile) */}
          <motion.button
            className="btn btn-icon btn-ghost mobile-search-btn"
            onClick={() => navigate('/search')}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Search"
          >
            <Search size={20} />
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            className="btn btn-icon btn-ghost"
            onClick={toggleDarkMode}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>

          {/* Notifications */}
          <motion.button
            className="btn btn-icon btn-ghost notification-btn"
            onClick={() => navigate('/notifications')}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount !== undefined && unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </motion.button>

          {/* User Menu */}
          <div className="user-menu">
            <motion.button
              className={clsx("user-menu-trigger", { active: showDropdown })}
              onClick={() => setShowDropdown(!showDropdown)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="avatar avatar-md">
                {session?.handle && (
                  <div className="avatar-placeholder">
                    {session.handle.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="user-handle">@{session?.handle || 'user'}</span>
              <motion.div
                className="user-menu-chevron"
                animate={{ rotate: showDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={16} />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  className="dropdown-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      navigate(`/profile/${session?.handle}`)
                      setShowDropdown(false)
                    }}
                  >
                    <User size={18} />
                    <span>Profile</span>
                  </button>
                  <button className="dropdown-item">
                    <Bookmark size={18} />
                    <span>Bookmarks</span>
                  </button>
                  <button className="dropdown-item">
                    <Settings size={18} />
                    <span>Settings</span>
                  </button>
                  <div className="divider" />
                  <button className="dropdown-item danger" onClick={logout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

    </motion.header>
  )
}