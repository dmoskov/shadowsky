import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Bookmark, HelpCircle, Info, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout, user, session } = useAuth();
  
  const menuItems = [
    { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
    { icon: Info, label: 'About', path: '/about' },
  ];

  // Add admin menu item for admin user
  if (session?.handle === 'moskov.goodventures.org') {
    menuItems.push({ icon: Shield, label: 'Admin', path: '/admin' });
  }
  
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
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      
      {/* Menu Panel */}
      <motion.div
        className="fixed top-0 left-0 h-full w-80 bg-gray-900 z-50 lg:hidden shadow-xl"
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-semibold">
                  {user?.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold">{user?.displayName || 'User'}</div>
              <div className="text-sm text-gray-400">@{user?.handle}</div>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
                onClick={() => handleNavigate(item.path)}
              >
                <Icon size={20} className="text-gray-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-800 p-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900/20 text-red-400 transition-colors text-left" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Log out</span>
          </button>
        </div>
      </motion.div>
    </>
  );
};