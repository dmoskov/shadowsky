import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  User, 
  Settings,
  Bookmark,
  Hash,
  Users,
  TrendingUp,
  PenSquare
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadNotificationCount } from '../../hooks/useNotifications'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: number
}

interface SidebarProps {
  onCompose?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onCompose }) => {
  const location = useLocation()
  const { session } = useAuth()
  const { data: unreadCount } = useUnreadNotificationCount()

  const navItems: NavItem[] = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { path: '/messages', label: 'Messages', icon: Mail },
    { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { path: `/profile/${session?.handle}`, label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  const trendingItems = [
    { path: '/explore', label: 'Explore', icon: Hash },
    { path: '/trending', label: 'Trending', icon: TrendingUp },
    { path: '/communities', label: 'Communities', icon: Users },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="nav-section">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx('nav-item', {
                'active': isActive(item.path)
              })}
            >
              <motion.div
                className="nav-item-content"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon size={22} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                )}
              </motion.div>
              {isActive(item.path) && (
                <motion.div
                  className="nav-indicator"
                  layoutId="sidebar-indicator"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </NavLink>
          ))}
        </div>

        <div className="nav-divider" />

        <div className="nav-section">
          <h3 className="nav-section-title">Discover</h3>
          {trendingItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx('nav-item', {
                'active': isActive(item.path)
              })}
            >
              <motion.div
                className="nav-item-content"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon size={22} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </motion.div>
            </NavLink>
          ))}
        </div>

        <motion.button
          className="compose-btn"
          onClick={onCompose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <PenSquare size={20} />
          <span>Compose</span>
        </motion.button>
      </nav>

      {/* User section at bottom */}
      <div className="sidebar-user">
        <div className="user-info">
          <div className="avatar avatar-md">
            {session?.handle && (
              <div className="avatar-placeholder">
                {session.handle.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="user-name">{session?.email?.split('@')[0] || 'User'}</div>
            <div className="user-handle">@{session?.handle || 'handle'}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}