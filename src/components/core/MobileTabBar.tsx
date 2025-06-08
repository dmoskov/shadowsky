import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Bell, User } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../contexts/AuthContext'

export const MobileTabBar: React.FC = () => {
  const location = useLocation()
  const { session } = useAuth()
  
  if (!session) return null

  const tabs = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: `/profile/${session.did}`, icon: User, label: 'Profile' },
  ]

  return (
    <nav className="mobile-tab-bar" role="navigation" aria-label="Mobile navigation">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || 
          (tab.path !== '/' && location.pathname.startsWith(tab.path))
        const Icon = tab.icon
        
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={clsx('mobile-tab-item', { active: isActive })}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon 
              size={24} 
              className={clsx('tab-icon', { filled: isActive })}
              fill={isActive ? 'currentColor' : 'none'}
            />
            <span className="tab-label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}