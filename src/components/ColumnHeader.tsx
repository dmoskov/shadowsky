import React from 'react';
import { X, MoreVertical, RefreshCw, Settings } from 'lucide-react';
import type { Column, ColumnType } from './SkyDeck';

interface ColumnHeaderProps {
  column: Column;
  onRemove: (columnId: string) => void;
  onRefresh?: () => void;
  children?: React.ReactNode;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({ 
  column, 
  onRemove, 
  onRefresh,
  children 
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  
  // Get display title based on column type
  const getDisplayTitle = () => {
    switch (column.type) {
      case 'feed':
        return column.title || 'Feed';
      case 'notifications':
        return 'Notifications';
      case 'timeline':
        return 'Visual Timeline';
      case 'conversations':
        return 'Conversations';
      case 'messages':
        return 'Messages';
      case 'bookmarks':
        return 'Bookmarks';
      default:
        return column.title || column.type;
    }
  };

  // Determine if column can be removed
  const canRemove = () => {
    // All columns can be removed except maybe a primary feed
    return true;
  };

  return (
    <div className="flex items-center justify-between p-3 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {getDisplayTitle()}
        </h2>
        {column.type === 'feed' && column.data && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {column.data.startsWith('at://') ? 'Custom' : ''}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        {/* Toolbar actions */}
        {children}
        
        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        
        {/* Direct remove button */}
        {canRemove() && (
          <button
            onClick={() => onRemove(column.id)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Remove column"
          >
            <X className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
          </button>
        )}
        
        {/* More menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="More options"
          >
            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-md shadow-lg border dark:border-gray-800 z-20">
                <div className="py-1">
                  {column.type === 'feed' && (
                    <button
                      onClick={() => {
                        // TODO: Implement settings
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Feed Settings
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};