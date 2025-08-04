import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { NotificationsFeed } from './NotificationsFeed';
import { VisualTimeline } from './VisualTimeline';
import { ConversationsSimple as Conversations } from './ConversationsSimple';
import SkyColumnFeed from './SkyColumnFeed';
import { Home } from './Home';
import { DirectMessages } from './DirectMessages';
import type { Column } from './SkyDeck';

interface SkyColumnProps {
  column: Column;
  onClose: () => void;
  chromeless?: boolean;
  isFocused?: boolean;
}

export default function SkyColumn({ column, onClose, chromeless = false, isFocused = false }: SkyColumnProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrollTop, setHasScrollTop] = useState(false);
  const [hasScrollBottom, setHasScrollBottom] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        setHasScrollTop(scrollTop > 10);
        setHasScrollBottom(scrollTop < scrollHeight - clientHeight - 10);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScroll);
      checkScroll(); // Initial check
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', checkScroll);
      }
    };
  }, []);

  // Render different components based on column type
  const renderContent = () => {
    switch (column.type) {
      case 'notifications':
        return <NotificationsFeed />;
      
      case 'timeline':
        return (
          <div className="h-full overflow-y-auto skydeck-scrollbar">
            <VisualTimeline hideTimeLabels={true} />
          </div>
        );
      
      case 'conversations':
        return <Conversations isFocused={isFocused} />;
      
      case 'messages':
        return <DirectMessages />;
      
      case 'feed':
        // Use the Home component for all feed columns
        return <Home initialFeedUri={column.data} isFocused={isFocused} />;
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-300">
              Column type "{column.type}" coming soon
            </p>
          </div>
        );
    }
  };

  if (chromeless) {
    // In chromeless mode, render content directly without wrapper
    return <div data-theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}>{renderContent()}</div>;
  }

  return (
    <div className="h-full rounded-lg shadow-lg flex flex-col overflow-hidden relative" data-theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}>
      {column.id !== 'home' && (
        <button
          onClick={onClose}
          className="column-close-button absolute top-2 right-2 z-10 p-1.5 rounded-full bg-gray-900/20 hover:bg-gray-900/30 dark:bg-gray-100/20 dark:hover:bg-gray-100/30 transition-all duration-200"
          title="Close column"
        >
          <X size={16} className="text-white dark:text-gray-900" />
        </button>
      )}
      
      <div 
        ref={scrollContainerRef}
        className={`h-full overflow-y-auto skydeck-scrollbar scroll-shadow-container ${
          hasScrollTop ? 'has-scroll-top' : ''
        } ${hasScrollBottom ? 'has-scroll-bottom' : ''}`}
      >
        {renderContent()}
      </div>
    </div>
  );
}