import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  Search, 
  Plus, 
  Bell, 
  User 
} from 'lucide-react'

const MobileBottomNav: React.FC = () => {
  const { pathname } = useLocation()
  
  const navItems = [
    { 
      path: '/', 
      icon: Home, 
      label: 'Home',
      isActive: pathname === '/'
    },
    { 
      path: '/search', 
      icon: Search, 
      label: 'Search',
      isActive: pathname === '/search'
    },
    { 
      path: '/compose', 
      icon: Plus, 
      label: 'Post',
      isActive: pathname === '/compose'
    },
    { 
      path: '/notifications', 
      icon: Bell, 
      label: 'Alerts',
      isActive: pathname === '/notifications'
    },
    { 
      path: '/profile', 
      icon: User, 
      label: 'Profile',
      isActive: pathname.startsWith('/profile')
    },
  ]
  
  const handleCompose = (e: React.MouseEvent) => {
    e.preventDefault()
    // Open compose modal instead of navigating
    const composeButton = document.querySelector('.compose-fab') as HTMLButtonElement
    if (composeButton) {
      composeButton.click()
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('openCompose'))
    }
  }
  
  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map(item => {
        const isCompose = item.path === '/compose'
        const Component = isCompose ? 'button' : Link
        const props = isCompose 
          ? { onClick: handleCompose, type: 'button' as const }
          : { to: item.path }
        
        return (
          <Component
            key={item.path}
            {...props}
            className={`nav-item ${item.isActive ? 'active' : ''}`}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
          >
            <item.icon size={24} aria-hidden="true" />
            <span>{item.label}</span>
          </Component>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav