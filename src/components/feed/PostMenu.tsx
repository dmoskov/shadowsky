import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Link, Check } from 'lucide-react';

interface PostMenuProps {
  isOpen: boolean;
  onCopyLink: () => void;
  copiedLink: boolean;
}

export const PostMenu: React.FC<PostMenuProps> = ({ 
  isOpen, 
  onCopyLink, 
  copiedLink 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="post-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <button 
            className="post-menu-item"
            onClick={onCopyLink}
          >
            {copiedLink ? (
              <>
                <Check size={16} />
                <span>Link copied!</span>
              </>
            ) : (
              <>
                <Link size={16} />
                <span>Copy link</span>
              </>
            )}
          </button>
          <button className="post-menu-item">
            <Bookmark size={16} />
            <span>Save post</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};