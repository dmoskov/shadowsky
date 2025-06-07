import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Bell, Mail, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: Mail, label: 'Messages', path: '/messages' },
    { icon: User, label: 'Profile', path: `/profile/${user?.handle || ''}` }
  ];
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  
  return (
    <nav className="mobile-nav-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        
        return (
          <motion.button
            key={item.path}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            whileTap={{ scale: 0.9 }}
          >
            <Icon size={24} />
            <span className="mobile-nav-label">{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};