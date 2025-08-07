import React, { useState, useEffect, useRef } from 'react';
import { Plus, Bell, Clock, MessageSquare, Hash, Star, Mail, Bookmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import SkyColumn from './SkyColumn';
import { columnFeedPrefs } from '../utils/cookies';

export type ColumnType = 'notifications' | 'timeline' | 'conversations' | 'feed' | 'messages' | 'bookmarks';

export interface Column {
  id: string;
  type: ColumnType;
  title?: string;
  data?: string; // Can be threadUri, feedUri, profileHandle, listUri etc
}


interface FeedGenerator {
  uri: string;
  displayName: string;
  description?: string;
  avatar?: string;
}

const columnOptions = [
  { type: 'feed' as ColumnType, label: 'Feed Column', icon: Hash, description: 'Add another feed column' },
  { type: 'notifications' as ColumnType, label: 'Notifications', icon: Bell, description: 'All your notifications' },
  { type: 'timeline' as ColumnType, label: 'Visual Timeline', icon: Clock, description: 'Timeline visualization' },
  { type: 'messages' as ColumnType, label: 'Messages', icon: Mail, description: 'Direct messages' },
  { type: 'conversations' as ColumnType, label: 'Conversations', icon: MessageSquare, description: 'Your conversations' },
  { type: 'bookmarks' as ColumnType, label: 'Bookmarks', icon: Bookmark, description: 'Your saved posts' },
];

export default function SkyDeck() {
  const { agent } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [_draggedElement, setDraggedElement] = useState<HTMLElement | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [isNarrowView, setIsNarrowView] = useState(false);
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [customFeedUri, setCustomFeedUri] = useState('');
  const [isLoadingCustomFeed, setIsLoadingCustomFeed] = useState(false);
  const columnsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch user's saved/pinned feeds
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated');
      const prefs = await agent.getPreferences();
      return prefs;
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always fetch fresh data on mount
  });
  
  // Fetch feed generator details for saved feeds
  const { data: feedGenerators } = useQuery({
    queryKey: ['feedGenerators', userPrefs?.savedFeeds],
    queryFn: async () => {
      if (!agent || !userPrefs?.savedFeeds?.length) return [];
      
      const feedUris = userPrefs.savedFeeds
        .filter((feed: any): boolean => feed.type === 'feed')
        .map((feed: any) => feed.value);
      
      if (feedUris.length === 0) return [];
      
      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris
        });
        return response.data.feeds;
      } catch (error) {
        console.error('Failed to fetch feed generators:', error);
        return [];
      }
    },
    enabled: !!agent && !!userPrefs?.savedFeeds
  });

  // Handle responsive width detection
  useEffect(() => {
    const checkWidth = () => {
      // Consider narrow view for screens less than 768px (tailwind md breakpoint)
      setIsNarrowView(window.innerWidth < 768);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Handle keyboard navigation between columns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields or when modals are open
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          document.body.classList.contains('thread-modal-open') ||
          document.body.classList.contains('conversation-modal-open')) {
        return;
      }

      // Column navigation with arrows and h/l (vim-style)
      if (e.key === 'ArrowLeft' || e.key === 'h') {
        e.preventDefault();
        setFocusedColumnIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        setFocusedColumnIndex(prev => Math.min(columns.length - 1, prev + 1));
      }
      // Space bar to scroll within focused column
      else if (e.key === ' ' && !e.shiftKey) {
        e.preventDefault();
        // Find the focused column's scroll container
        const columnElements = columnsContainerRef.current?.querySelectorAll('.column-wrapper');
        const focusedColumn = columnElements?.[focusedColumnIndex];
        const scrollContainer = focusedColumn?.querySelector('.skydeck-scrollbar');
        if (scrollContainer) {
          scrollContainer.scrollBy({ top: scrollContainer.clientHeight * 0.8, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [columns.length, focusedColumnIndex]);

  // Scroll focused column into view
  useEffect(() => {
    if (columnsContainerRef.current && columns.length > 0) {
      const container = columnsContainerRef.current;
      const columnElements = container.querySelectorAll('.column-wrapper');
      const focusedElement = columnElements[focusedColumnIndex] as HTMLElement;
      
      if (focusedElement) {
        focusedElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [focusedColumnIndex, columns.length]);

  useEffect(() => {
    const homeColumn: Column = {
      id: 'home',
      type: 'feed',
      title: 'Home',
      data: 'following' // Default to following feed
    };
    
    const savedColumns = localStorage.getItem('skyDeckColumns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        // Ensure the first column is always Home
        if (parsed.length === 0 || parsed[0].id !== 'home') {
          const restoredColumns = [homeColumn, ...parsed.filter((col: Column) => col.id !== 'home')].map((col: Column) => {
            if (col.type === 'feed' && col.id) {
              const savedFeed = columnFeedPrefs.getFeedForColumn(col.id);
              if (savedFeed) {
                return { ...col, data: savedFeed };
              }
            }
            return col;
          });
          setColumns(restoredColumns);
        } else {
          // Restore feed preferences from cookies
          const restoredColumns = parsed.map((col: Column) => {
            if (col.type === 'feed' && col.id) {
              const savedFeed = columnFeedPrefs.getFeedForColumn(col.id);
              if (savedFeed) {
                return { ...col, data: savedFeed };
              }
            }
            return col;
          });
          setColumns(restoredColumns);
        }
      } catch {
        // If parsing fails, start with just home column
        setColumns([homeColumn]);
      }
    } else {
      // First time - just home column
      setColumns([homeColumn]);
    }
  }, []);

  useEffect(() => {
    if (columns.length > 0) {
      localStorage.setItem('skyDeckColumns', JSON.stringify(columns));
    }
  }, [columns]);

  const handleAddColumn = (type: ColumnType, feedUri?: string, feedTitle?: string) => {
    const newColumn: Column = {
      id: Date.now().toString(),
      type: type,
      title: feedTitle || (type === 'feed' ? 'Feed' : columnOptions.find(opt => opt.type === type)?.label || type),
      data: feedUri || (type === 'feed' ? 'following' : undefined),
    };

    setColumns([...columns, newColumn]);
    setIsAddingColumn(false);
    
    // Focus and scroll to the new column
    setTimeout(() => {
      setFocusedColumnIndex(columns.length);
      
      // Scroll to show the new column
      if (columnsContainerRef.current) {
        const container = columnsContainerRef.current;
        const newColumnElement = container.querySelector('.column-wrapper:last-of-type') as HTMLElement;
        if (newColumnElement) {
          newColumnElement.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
        }
      }
    }, 100);
  };

  const handleRemoveColumn = (id: string) => {
    // Don't allow removing the home column
    if (id === 'home') return;
    setColumns(columns.filter(col => col.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setIsDragging(id);
    setDraggedElement(e.currentTarget as HTMLElement);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, e.clientX - e.currentTarget.getBoundingClientRect().left, 20);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    
    if (isDragging && isDragging !== dropId) {
      const dragIndex = columns.findIndex(col => col.id === isDragging);
      const dropIndex = columns.findIndex(col => col.id === dropId);
      
      const newColumns = [...columns];
      const [draggedColumn] = newColumns.splice(dragIndex, 1);
      newColumns.splice(dropIndex, 0, draggedColumn);
      
      setColumns(newColumns);
    }
    
    setIsDragging(null);
    setDragOverId(null);
  };

  // In narrow view, show only the home column without chrome
  if (isNarrowView && columns.length > 0) {
    // Ensure we're showing the home column
    const homeColumn = columns.find(col => col.id === 'home') || columns[0];
    return (
      <div className="h-full dark:bg-gray-900 overflow-hidden">
        <SkyColumn
          column={homeColumn}
          onClose={() => handleRemoveColumn(homeColumn.id)}
          chromeless={true}
        />
      </div>
    );
  }

  // Full multi-column view for wider screens
  return (
    <div className="h-full flex flex-col dark:bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 skydeck-columns-scrollbar">
        <div ref={columnsContainerRef} className="h-full flex gap-4 min-w-min px-2">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className={`column-wrapper w-96 h-full ${
                isDragging === column.id ? 'column-dragging' : ''
              } ${
                dragOverId === column.id && isDragging !== column.id ? 'column-drag-over' : ''
              } ${
                focusedColumnIndex === index ? 'column-focused rounded-lg' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, column.id)}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragEnd={() => {
                setIsDragging(null);
                setDragOverId(null);
                setDraggedElement(null);
              }}
              onDragLeave={() => {
                if (dragOverId === column.id) {
                  setDragOverId(null);
                }
              }}
              onClick={() => setFocusedColumnIndex(index)}
              onClickCapture={() => {
                // Also handle clicks in capture phase to ensure column gets focused
                // even if child elements stop propagation
                setFocusedColumnIndex(index)
              }}
            >
              <SkyColumn
                column={column}
                onClose={() => handleRemoveColumn(column.id)}
                isFocused={focusedColumnIndex === index}
              />
            </div>
          ))}
          
          <div className="w-96 h-full">
            {isAddingColumn ? (
              <div className="h-full dark:bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col animate-fade-in">
                <div className="flex-1 overflow-y-auto">
                  <div className="grid gap-2">
                    {columnOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.type}
                          onClick={() => handleAddColumn(option.type)}
                          className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-left min-h-[4rem]"
                        >
                          <Icon className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-normal">
                              {option.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    
                    {/* Add Feed Section */}
                    {userPrefs?.savedFeeds && feedGenerators && feedGenerators.length > 0 && (
                      <>
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 mb-2">
                            Add Feed
                          </h4>
                          <div className="grid gap-1">
                            {userPrefs.savedFeeds
                              .filter((feed: any) => feed.type === 'feed')
                              .map((savedFeed: any) => {
                                const generator = feedGenerators.find(
                                  (g: FeedGenerator) => g.uri === savedFeed.value
                                );
                                if (!generator) return null;
                                
                                return (
                                  <button
                                    key={savedFeed.value}
                                    onClick={() => handleAddColumn('feed', savedFeed.value, generator.displayName)}
                                    className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-left"
                                  >
                                    {savedFeed.pinned ? (
                                      <Star className="w-4 h-4 text-yellow-500 mt-0.5" />
                                    ) : (
                                      <Hash className="w-4 h-4 text-gray-400 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {generator.displayName}
                                      </div>
                                      {generator.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                          {generator.description}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Add Custom Feed by URI */}
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 mb-2">
                        Add Custom Feed by URI
                      </h4>
                      <div className="px-3 flex gap-2">
                        <input
                          type="text"
                          value={customFeedUri}
                          onChange={(e) => setCustomFeedUri(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && customFeedUri.trim() && !isLoadingCustomFeed) {
                              e.preventDefault();
                              document.getElementById('add-feed-button')?.click();
                            }
                          }}
                          placeholder="at://did:plc:xyz/app.bsky.feed.generator/feed-name"
                          className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          id="add-feed-button"
                          onClick={async () => {
                            if (customFeedUri.trim()) {
                              setIsLoadingCustomFeed(true);
                              try {
                                // Try to fetch feed info
                                const response = await agent?.app.bsky.feed.getFeedGenerators({
                                  feeds: [customFeedUri.trim()]
                                });
                                if (response?.data.feeds[0]) {
                                  const feed = response.data.feeds[0];
                                  handleAddColumn('feed', feed.uri, feed.displayName);
                                  setCustomFeedUri('');
                                } else {
                                  // If no feed info, add with URI as name
                                  handleAddColumn('feed', customFeedUri.trim(), customFeedUri.trim());
                                  setCustomFeedUri('');
                                }
                              } catch (error) {
                                console.error('Error fetching feed:', error);
                                // Add anyway with URI as name
                                handleAddColumn('feed', customFeedUri.trim(), customFeedUri.trim());
                                setCustomFeedUri('');
                              } finally {
                                setIsLoadingCustomFeed(false);
                              }
                            }
                          }}
                          disabled={!customFeedUri.trim() || isLoadingCustomFeed}
                          className="w-10 h-10 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                          title="Add Feed"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => setIsAddingColumn(false)}
                      className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="add-column-button h-full w-full dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all duration-300 group"
              >
                <Plus className="w-12 h-12 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}