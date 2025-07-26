import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Bell, MessageSquare } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../contexts/AuthContext'

export const MobileTabBar: React.FC = () => {
  const location = useLocation()
  const { session } = useAuth()
  
  if (!session) return null

  const tabs = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/conversations', icon: MessageSquare, label: 'Chat' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 lg:hidden z-40" role="navigation" aria-label="Mobile navigation">
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || 
            (tab.path !== '/' && location.pathname.startsWith(tab.path))
          const Icon = tab.icon
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon 
                size={24} 
                className={clsx(isActive && 'text-blue-400')}
                fill={isActive ? 'currentColor' : 'none'}
              />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}