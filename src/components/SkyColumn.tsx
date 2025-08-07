import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { NotificationsFeed } from './NotificationsFeed';
import { VisualTimeline } from './VisualTimeline';
import { ConversationsSimple as Conversations } from './ConversationsSimple';
import { Home } from './Home';
import { DirectMessages } from './DirectMessages';
import { BookmarksColumn } from './BookmarksColumn';
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
            <VisualTimeline hideTimeLabels={true} isInSkyDeck={true} isFocused={isFocused} onClose={onClose} />
          </div>
        );
      
      case 'conversations':
        return <Conversations isFocused={isFocused} onClose={onClose} />;
      
      case 'messages':
        return <DirectMessages />;
      
      case 'bookmarks':
        return <BookmarksColumn isFocused={isFocused} onClose={onClose} />;
      
      case 'feed':
        // Use the Home component for all feed columns
        return <Home initialFeedUri={column.data} isFocused={isFocused} columnId={column.id} onClose={column.id !== 'home' ? onClose : undefined} />;
      
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
      <div className="h-full relative overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto skydeck-scrollbar"
        >
          {renderContent()}
        </div>
        {/* Fade overlays positioned outside the scroll container */}
        <div className={`absolute inset-0 pointer-events-none scroll-shadow-overlay ${
          hasScrollTop ? 'has-scroll-top' : ''
        } ${hasScrollBottom ? 'has-scroll-bottom' : ''}`} />
      </div>
    </div>
  );
}