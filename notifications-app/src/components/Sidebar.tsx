import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard,
  Bell,
  Clock,
  BarChart3,
  Settings,
  User,
  ExternalLink,
  X
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/notifications', label: 'All Notifications', icon: Bell },
    { path: '/timeline', label: 'Timeline View', icon: Clock },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/profile/me', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-16 left-0 bottom-0 w-64 bsky-glass
        transform transition-transform duration-300 z-40
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `} style={{ borderRight: '1px solid var(--bsky-border-primary)' }}>
        <div className="flex items-center justify-between p-4 lg:hidden">
          <h2 className="text-lg font-bold bsky-gradient-text">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all"
          >
            <X size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
          </button>
        </div>

        <nav className="px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onClose()}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bsky-button-primary shadow-md' 
                  : 'hover:bg-white hover:bg-opacity-5'
                }
              `}
              style={({ isActive }) => ({
                color: isActive ? 'white' : 'var(--bsky-text-secondary)'
              })}
            >
              <item.icon size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium group-hover:text-white transition-colors">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="my-4 mx-4 border-t" style={{ borderColor: 'var(--bsky-border-primary)' }}></div>

        {/* External Links */}
        <div className="px-4 space-y-1">
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white hover:bg-opacity-5 transition-all duration-200 group"
            style={{ color: 'var(--bsky-text-secondary)' }}
          >
            <ExternalLink size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium group-hover:text-white transition-colors">Open Bluesky</span>
          </a>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'var(--bsky-border-primary)' }}>
          <div className="text-xs text-center" style={{ color: 'var(--bsky-text-tertiary)' }}>
            <div className="bsky-gradient-text font-bold mb-1">Notifications+</div>
            <div>Version 0.1.0</div>
          </div>
        </div>
      </aside>
    </>
  )
}