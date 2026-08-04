import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RefreshCw,
  X,
} from "lucide-react";
import React from "react";
import ReactDOM from "react-dom";
import { layoutMeasurementService } from "../services/layout-measurement-service";
import type { Column } from "../types/column";

interface ColumnHeaderProps {
  column: Column;
  /** Omitted for derived feed columns, which are removed by unsaving the feed. */
  onRemove?: (columnId: string) => void;
  onRefresh?: () => void;
  /** Narrow view only: step to the previous/next column. */
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  children?: React.ReactNode;
}

const ColumnHeaderComponent: React.FC<ColumnHeaderProps> = ({
  column,
  onRemove,
  onRefresh,
  onMoveLeft,
  onMoveRight,
  children,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = React.useState<{
    top: number;
    right: number;
  } | null>(null);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);

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

  return (
    <div className="flex items-center justify-between border-b border-asph-border-primary bg-asph-bg-secondary px-4 py-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-asph-text-primary">
          {getDisplayTitle()}
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

        {/* Direct remove button */}
        {onRemove && (
          <button
            onClick={() => onRemove(column.id)}
            className="touch-target-icon rounded-md p-2 transition-opacity hover:opacity-70"
            title="Remove column"
          >
            <X className="h-4 w-4 text-asph-text-tertiary hover:text-red-600 dark:hover:text-red-400" />
          </button>
        )}

        {/* Column stepping (narrow view only) */}
        {(onMoveLeft || onMoveRight) && (
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
                          Previous column
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
                          Next column
                        </button>
                      )}
                    </div>
                  </div>
                </>,
                document.body,
              )}
          </div>
        )}
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
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onMoveLeft === nextProps.onMoveLeft &&
      prevProps.onMoveRight === nextProps.onMoveRight
      // Callbacks are expected to be stable (using useCallback in parent)
    );
  },
);

ColumnHeader.displayName = "ColumnHeader";
