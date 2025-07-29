import React from 'react'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { ButterflyIcon } from './icons/ButterflyIcon'

interface HeaderProps {
  onMenuToggle: () => void
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { session, logout } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bsky-glass z-50" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
      <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all"
          >
            <Menu size={24} style={{ color: 'var(--bsky-text-primary)' }} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--bsky-primary), var(--bsky-accent))' }}>
              <ButterflyIcon size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold hidden sm:block bsky-gradient-text">ShadowSky</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            {session?.avatar && (
              <img 
                src={session.avatar} 
                alt={session.handle} 
                className="w-8 h-8 bsky-avatar"
              />
            )}
            <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>
              @{session?.handle || 'user'}
            </span>
          </div>
          <ThemeToggle />
          <button
            onClick={logout}
            className="bsky-button-ghost flex items-center gap-1.5 text-sm"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}