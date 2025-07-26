import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Bell, Plus, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/', type: 'link' as const },
    { icon: Search, label: 'Search', path: '/search', type: 'link' as const },
    { icon: MessageSquare, label: 'Chat', path: '/conversations', type: 'link' as const },
    { icon: Bell, label: 'Alerts', path: '/notifications', type: 'link' as const },
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
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 lg:hidden z-40" role="navigation" aria-label="Main navigation">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <motion.button
              key={item.path}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                active ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
              }`}
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
      </div>
    </nav>
  );
};