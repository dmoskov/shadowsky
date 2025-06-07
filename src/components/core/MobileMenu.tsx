import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Bookmark, HelpCircle, Info, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  
  const menuItems = [
    { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
    { icon: Info, label: 'About', path: '/about' },
  ];
  
  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };
  
  const handleLogout = () => {
    logout();
    onClose();
  };
  
  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobile-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      
      {/* Menu Panel */}
      <motion.div
        className={`mobile-menu ${isOpen ? 'active' : ''}`}
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="mobile-menu-header">
          <div className="mobile-menu-user">
            <div className="avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.displayName} />
              ) : (
                <div className="avatar-placeholder">
                  {user?.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.displayName || 'User'}</div>
              <div className="user-handle">@{user?.handle}</div>
            </div>
          </div>
          <button className="mobile-menu-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="mobile-menu-section">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className="mobile-menu-item"
                onClick={() => handleNavigate(item.path)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="mobile-menu-section mobile-menu-footer">
          <button className="mobile-menu-item danger" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Log out</span>
          </button>
        </div>
      </motion.div>
    </>
  );
};