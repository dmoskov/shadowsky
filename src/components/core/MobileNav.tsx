import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Bell, Plus, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/', type: 'link' as const },
    { icon: Search, label: 'Search', path: '/search', type: 'link' as const },
    { icon: Plus, label: 'Post', path: '/compose', type: 'compose' as const },
    { icon: Bell, label: 'Alerts', path: '/notifications', type: 'link' as const },
    { icon: User, label: 'Profile', path: `/profile/${user?.handle || ''}`, type: 'link' as const }
  ];
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/compose') return false; // Compose is always inactive since it's a modal
    return location.pathname.startsWith(path);
  };
  
  const handleItemClick = (item: typeof navItems[0]) => {
    if (item.type === 'compose') {
      // Open compose modal instead of navigating
      const composeButton = document.querySelector('.compose-fab') as HTMLButtonElement;
      if (composeButton) {
        composeButton.click();
      } else {
        // Fallback: dispatch custom event
        window.dispatchEvent(new CustomEvent('openCompose'));
      }
    } else {
      navigate(item.path);
    }
  };
  
  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Main navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        
        return (
          <motion.button
            key={item.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
            whileTap={{ scale: 0.9 }}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={24} aria-hidden="true" />
            <span>{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};