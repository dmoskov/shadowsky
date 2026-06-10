import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import React from "react";
import ReactDOM from "react-dom";
import { layoutMeasurementService } from "../services/layout-measurement-service";
import type { Column } from "../types/column";

interface ColumnHeaderProps {
  column: Column;
  onRemove: (columnId: string) => void;
  onRefresh?: () => void;
  onFeedChange?: (feed: string) => void;
  onDiscoverFeeds?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  currentFeedLabel?: string;
  feedOptions?: Array<{ type: string; label: string; icon: LucideIcon }>;
  children?: React.ReactNode;
}

const ColumnHeaderComponent: React.FC<ColumnHeaderProps> = ({
  column,
  onRemove,
  onRefresh,
  onFeedChange,
  onDiscoverFeeds,
  onMoveLeft,
  onMoveRight,
  currentFeedLabel,
  feedOptions,
  children,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showFeedDropdown, setShowFeedDropdown] = React.useState(false);
  const [feedMenuPosition, setFeedMenuPosition] = React.useState<{
    top: number;
    right: number;
  } | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = React.useState<{
    top: number;
    right: number;
  } | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const feedButtonRef = React.useRef<HTMLButtonElement>(null);
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowFeedDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get display title based on column type
  const getDisplayTitle = () => {
    switch (column.type) {
      case "feed":
        return column.title || "Feed";
      case "notifications":
        return "Notifications";
      case "timeline":
        return "Visual Timeline";
      case "messages":
        return "Messages";
      case "bookmarks":
        return "Bookmarks";
      case "search":
        return "Search";
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
    <div className="flex items-center justify-between border-b border-asph-border-primary bg-asph-bg-secondary px-4 py-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-asph-text-primary">
          {column.type === "feed" && currentFeedLabel
            ? currentFeedLabel
            : getDisplayTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-1">
        {/* Toolbar actions */}
        {children}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="touch-target-icon rounded-md p-2 transition-opacity hover:opacity-70"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-asph-text-tertiary" />
          </button>
        )}

        {/* Feed change button */}
        {column.type === "feed" && onFeedChange && feedOptions && (
          <div className="relative" ref={dropdownRef}>
            <button
              ref={feedButtonRef}
              onClick={() => {
                if (!showFeedDropdown && feedButtonRef.current) {
                  // Use batched measurement service for positioning
                  layoutMeasurementService.measureElement(
                    feedButtonRef.current,
                    (rect) => {
                      setFeedMenuPosition({
                        top: rect.bottom + 4,
                        right: window.innerWidth - rect.right,
                      });
                      setShowFeedDropdown(true);
                    },
                    { priority: "high" },
                  );
                } else {
                  setShowFeedDropdown(false);
                }
              }}
              className="touch-target flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-asph-bg-hover"
              title="Change feed"
            >
              <span className="text-asph-text-secondary">Change</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-asph-text-secondary transition-transform ${showFeedDropdown ? "rotate-180" : ""}`}
              />
            </button>

            {showFeedDropdown &&
              feedMenuPosition &&
              ReactDOM.createPortal(
                <div
                  ref={dropdownRef}
                  className="asph-scrollbar fixed z-[9999] max-h-96 w-64 overflow-y-auto rounded-md border border-asph-border-primary bg-asph-bg-secondary shadow-lg"
                  style={{
                    top: `${feedMenuPosition.top}px`,
                    right: `${feedMenuPosition.right}px`,
                  }}
                >
                  <div className="py-1">
                    {feedOptions.map((option) => (
                      <button
                        key={option.type}
                        onClick={() => {
                          onFeedChange(option.type);
                          setShowFeedDropdown(false);
                        }}
                        className="touch-target-list-item flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-asph-bg-hover"
                      >
                        <option.icon className="h-4 w-4 text-asph-text-secondary" />
                        <span className="text-sm text-asph-text-primary">
                          {option.label}
                        </span>
                      </button>
                    ))}
                    {onDiscoverFeeds && (
                      <>
                        <div className="border-t border-asph-border-primary" />
                        <button
                          onClick={() => {
                            onDiscoverFeeds();
                            setShowFeedDropdown(false);
                          }}
                          className="touch-target-list-item flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-asph-bg-hover"
                        >
                          <Plus className="h-4 w-4 text-asph-text-secondary" />
                          <span className="text-sm text-asph-text-primary">
                            Discover Feeds...
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>,
                document.body,
              )}
          </div>
        )}

        {/* Direct remove button */}
        {canRemove() && (
          <button
            onClick={() => onRemove(column.id)}
            className="touch-target-icon rounded-md p-2 transition-opacity hover:opacity-70"
            title="Remove column"
          >
            <X className="h-4 w-4 text-asph-text-tertiary hover:text-red-600 dark:hover:text-red-400" />
          </button>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            ref={moreButtonRef}
            onClick={() => {
              if (!showMenu && moreButtonRef.current) {
                // Use batched measurement service for positioning
                layoutMeasurementService.measureElement(
                  moreButtonRef.current,
                  (rect) => {
                    setMoreMenuPosition({
                      top: rect.bottom + 4,
                      right: window.innerWidth - rect.right,
                    });
                    setShowMenu(true);
                  },
                  { priority: "high" },
                );
              } else {
                setShowMenu(false);
              }
            }}
            className="touch-target rounded-md p-2 transition-opacity hover:opacity-70"
            title="More options"
          >
            <MoreVertical className="h-4 w-4 text-asph-text-tertiary" />
          </button>

          {showMenu &&
            moreMenuPosition &&
            ReactDOM.createPortal(
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  ref={moreMenuRef}
                  className="fixed z-[9999] w-48 rounded-md border border-asph-border-primary bg-asph-bg-secondary shadow-lg"
                  style={{
                    top: `${moreMenuPosition.top}px`,
                    right: `${moreMenuPosition.right}px`,
                  }}
                >
                  <div className="py-1">
                    {onMoveLeft && (
                      <button
                        onClick={() => {
                          onMoveLeft();
                          setShowMenu(false);
                        }}
                        className="touch-target-list-item flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-asph-bg-hover"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Move Left
                      </button>
                    )}
                    {onMoveRight && (
                      <button
                        onClick={() => {
                          onMoveRight();
                          setShowMenu(false);
                        }}
                        className="touch-target-list-item flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-asph-bg-hover"
                      >
                        <ChevronRight className="h-4 w-4" />
                        Move Right
                      </button>
                    )}
                  </div>
                </div>
              </>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
};

/**
 * Memoized ColumnHeader for optimal SkyDeck performance
 * Prevents re-renders when column state hasn't changed
 */
export const ColumnHeader = React.memo(
  ColumnHeaderComponent,
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.column.id === nextProps.column.id &&
      prevProps.column.type === nextProps.column.type &&
      prevProps.column.title === nextProps.column.title &&
      prevProps.currentFeedLabel === nextProps.currentFeedLabel &&
      prevProps.feedOptions?.length === nextProps.feedOptions?.length
      // Callbacks are expected to be stable (using useCallback in parent)
    );
  },
);

ColumnHeader.displayName = "ColumnHeader";
