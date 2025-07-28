import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  Settings,
  Bookmark,
  Hash,
  Users,
  TrendingUp,
  PenSquare,
  BarChart3,
  Shield
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnreadNotificationCount } from '../../hooks/useNotifications'
import { debug } from '@bsky/shared'

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
    { path: '/conversations', label: 'Conversations', icon: Mail },
    { path: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  // Add admin dashboard for admin user only
  debug.log('Sidebar - Current session handle:', session?.handle)
  if (session?.handle === 'moskov.goodventures.org') {
    debug.log('Adding admin nav item')
    navItems.push({ path: '/admin', label: 'Admin', icon: Shield })
  }

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
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-64 
                     bg-gray-900 border-r border-gray-800 pt-4"
           role="navigation"
           aria-label="Main navigation">
      <nav id="main-navigation" className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                relative flex items-center px-3 py-2 rounded-lg
                transition-all duration-200 group
                ${isActive(item.path) 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              <motion.div
                className="flex items-center w-full"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon size={22} className="mr-3" aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-xs 
                                 rounded-full px-2 py-0.5 font-medium"
                        aria-label={`${item.badge} unread`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </motion.div>
              {isActive(item.path) && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r"
                  layoutId="sidebar-indicator"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </NavLink>
          ))}
        </div>

        <div className="my-4 border-t border-gray-800" />

        <div className="space-y-1">
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Discover
          </h3>
          {trendingItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                relative flex items-center px-3 py-2 rounded-lg
                transition-all duration-200 group
                ${isActive(item.path) 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              <motion.div
                className="flex items-center w-full"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon size={22} className="mr-3" aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </motion.div>
            </NavLink>
          ))}
        </div>

        <motion.button
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium 
                     py-3 px-4 rounded-full flex items-center justify-center space-x-2
                     transition-colors duration-200"
          onClick={onCompose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-label="Compose new post"
        >
          <PenSquare size={20} aria-hidden="true" />
          <span>Compose</span>
        </motion.button>
      </nav>

      {/* User section at bottom */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 
                         flex items-center justify-center text-white font-medium">
            {session?.handle?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-200 truncate">
              {session?.email?.split('@')[0] || 'User'}
            </div>
            <div className="text-xs text-gray-400 truncate">
              @{session?.handle || 'handle'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}