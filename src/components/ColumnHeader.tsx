import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import React from "react";
import type { Column } from "./SkyDeck";

interface ColumnHeaderProps {
  column: Column;
  onRemove: (columnId: string) => void;
  onRefresh?: () => void;
  onFeedChange?: (feed: string) => void;
  onDiscoverFeeds?: () => void;
  currentFeedLabel?: string;
  feedOptions?: Array<{ type: string; label: string; icon: LucideIcon }>;
  children?: React.ReactNode;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  column,
  onRemove,
  onRefresh,
  onFeedChange,
  onDiscoverFeeds,
  currentFeedLabel,
  feedOptions,
  children,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showFeedDropdown, setShowFeedDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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
      case "conversations":
        return "Conversations";
      case "messages":
        return "Messages";
      case "bookmarks":
        return "Bookmarks";
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
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-950">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
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
            className="rounded-md p-2 transition-opacity hover:opacity-70"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Feed change button */}
        {column.type === "feed" && onFeedChange && feedOptions && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFeedDropdown(!showFeedDropdown)}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Change feed"
            >
              <span className="text-gray-600 dark:text-gray-400">Change</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-600 transition-transform dark:text-gray-400 ${showFeedDropdown ? "rotate-180" : ""}`}
              />
            </button>

            {showFeedDropdown && (
              <div className="absolute right-0 top-full z-30 mt-1 max-h-96 w-64 overflow-y-auto rounded-md border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="py-1">
                  {feedOptions.map((option) => (
                    <button
                      key={option.type}
                      onClick={() => {
                        onFeedChange(option.type);
                        setShowFeedDropdown(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <option.icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {option.label}
                      </span>
                    </button>
                  ))}
                  {onDiscoverFeeds && (
                    <>
                      <div className="border-t dark:border-gray-700" />
                      <button
                        onClick={() => {
                          onDiscoverFeeds();
                          setShowFeedDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          Discover Feeds...
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Direct remove button */}
        {canRemove() && (
          <button
            onClick={() => onRemove(column.id)}
            className="rounded-md p-2 transition-opacity hover:opacity-70"
            title="Remove column"
          >
            <X className="h-4 w-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-2 transition-opacity hover:opacity-70"
            title="More options"
          >
            <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="py-1">
                  {column.type === "feed" && (
                    <button
                      onClick={() => {
                        // TODO: Implement settings
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
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
