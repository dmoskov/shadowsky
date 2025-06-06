import React, { useState } from 'react'
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
import { useAuth } from '../contexts/AuthContext'
import { useUnreadNotificationCount } from '../hooks/useNotifications'
import clsx from 'clsx'

export const Header: React.FC = () => {
  const { logout, session } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [darkMode, setDarkMode] = useState(true) // For now, always dark
  const navigate = useNavigate()
  const { data: unreadCount } = useUnreadNotificationCount()

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    // TODO: Implement theme switching
  }

  return (
    <motion.header 
      className="header"
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
        <div className="header-search">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search Bluesky..." 
            className="search-input"
          />
        </div>

        {/* Actions */}
        <div className="header-actions">
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