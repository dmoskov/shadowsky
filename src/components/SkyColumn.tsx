import React from 'react';
import { X } from 'lucide-react';
import { NotificationsFeed } from './NotificationsFeed';
import { VisualTimeline } from './VisualTimeline';
import { ConversationsSimple as Conversations } from './ConversationsSimple';
import SkyColumnFeed from './SkyColumnFeed';
import { Home } from './Home';
import type { Column } from './SkyDeck';

interface SkyColumnProps {
  column: Column;
  onClose: () => void;
  chromeless?: boolean;
}

export default function SkyColumn({ column, onClose, chromeless = false }: SkyColumnProps) {

  // Render different components based on column type
  const renderContent = () => {
    switch (column.type) {
      case 'notifications':
        return <NotificationsFeed />;
      
      case 'timeline':
        return (
          <div className="h-full overflow-y-auto">
            <VisualTimeline />
          </div>
        );
      
      case 'conversations':
        return <Conversations />;
      
      case 'feed':
        // Use the full Home component for the home column
        if (column.id === 'home') {
          return <Home />;
        }
        return <SkyColumnFeed feedUri={column.data} />;
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Column type "{column.type}" coming soon
            </p>
          </div>
        );
    }
  };

  if (chromeless) {
    // In chromeless mode, render content directly without wrapper
    return renderContent();
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {column.title || column.type}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {column.id !== 'home' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Close column"
            >
              <X size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}