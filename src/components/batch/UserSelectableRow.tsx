/**
 * UserSelectableRow Component
 *
 * A user row component that can be selected for batch operations.
 * Displays user info with a checkbox when in selection mode.
 */

import type { AppBskyActorDefs } from "@atproto/api";
import { Check } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import type { SelectableUser } from "../../contexts/BatchSelectionContext";
import {
  profileToSelectableUser,
  useBatchSelection,
} from "../../contexts/BatchSelectionContext";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { DomainVerifiedBadgeInline } from "../ui/DomainVerifiedBadge";
import { ProfileHoverCard } from "../ui/ProfileHoverCard";

interface UserSelectableRowProps {
  /** User profile data */
  user: AppBskyActorDefs.ProfileView;
  /** Optional relationship URI (for unfollow operations) */
  relationshipUri?: string;
  /** Click handler for non-selection mode */
  onClick?: (handle: string) => void;
  /** Whether this row is focused */
  isFocused?: boolean;
  /** Index for accessibility */
  index?: number;
  /** Custom className */
  className?: string;
}

export const UserSelectableRow: React.FC<UserSelectableRowProps> = ({
  user,
  relationshipUri,
  onClick,
  isFocused = false,
  index: _index,
  className = "",
}) => {
  const { isSelectionMode, isSelected, toggleUser } = useBatchSelection();
  const rowRef = useRef<HTMLDivElement>(null);

  const selectableUser: SelectableUser = profileToSelectableUser(
    user,
    relationshipUri,
  );
  const selected = isSelected(user.did);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isSelectionMode) {
        e.preventDefault();
        e.stopPropagation();
        toggleUser(selectableUser);
      } else if (onClick) {
        onClick(user.handle);
      }
    },
    [isSelectionMode, toggleUser, selectableUser, onClick, user.handle],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSelectionMode && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        toggleUser(selectableUser);
      } else if (!isSelectionMode && e.key === "Enter" && onClick) {
        onClick(user.handle);
      }
    },
    [isSelectionMode, toggleUser, selectableUser, onClick, user.handle],
  );

  // Scroll focused item into view
  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  return (
    <div
      ref={rowRef}
      role={isSelectionMode ? "option" : "button"}
      aria-selected={isSelectionMode ? selected : undefined}
      tabIndex={isFocused ? 0 : -1}
      className={`flex cursor-pointer items-center gap-3 border-b p-4 outline-none transition-colors dark:border-gray-700 ${
        isSelectionMode && selected
          ? "bg-blue-50 dark:bg-blue-900/20"
          : isFocused
            ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/30"
            : "hover:bg-gray-50 dark:hover:bg-gray-800"
      } ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            selected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
          }`}
          aria-hidden="true"
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
      )}

      {/* Avatar */}
      <ProfileHoverCard handle={user.handle}>
        <img
          src={
            user.avatar ? proxifyBskyImage(user.avatar) : "/default-avatar.svg"
          }
          alt=""
          aria-hidden="true"
          className="h-12 w-12 flex-shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-80"
        />
      </ProfileHoverCard>

      {/* User info */}
      <div className="min-w-0 flex-1">
        <ProfileHoverCard handle={user.handle}>
          <div className="cursor-pointer truncate font-medium hover:underline">
            {user.displayName || user.handle}
          </div>
        </ProfileHoverCard>
        <div className="flex items-center text-sm text-asph-text-tertiary">
          <ProfileHoverCard handle={user.handle}>
            <span className="cursor-pointer truncate hover:underline">
              @{user.handle}
            </span>
          </ProfileHoverCard>
          <DomainVerifiedBadgeInline handle={user.handle} />
        </div>
        {user.description && (
          <div className="mt-1 line-clamp-2 text-sm text-asph-text-secondary">
            {user.description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Hook to handle Shift+click range selection
 */
export function useRangeSelection(
  users: AppBskyActorDefs.ProfileView[],
  relationshipUris?: Map<string, string>,
) {
  const { selectUser, deselectUser, isSelected } = useBatchSelection();
  const lastClickedRef = useRef<number | null>(null);

  const handleRangeSelect = useCallback(
    (index: number, shiftKey: boolean) => {
      if (!shiftKey || lastClickedRef.current === null) {
        lastClickedRef.current = index;
        return;
      }

      const start = Math.min(lastClickedRef.current, index);
      const end = Math.max(lastClickedRef.current, index);
      const isSelecting = !isSelected(users[index].did);

      for (let i = start; i <= end; i++) {
        const user = users[i];
        const relationshipUri = relationshipUris?.get(user.did);
        const selectableUser = profileToSelectableUser(user, relationshipUri);

        if (isSelecting) {
          selectUser(selectableUser);
        } else {
          deselectUser(user.did);
        }
      }

      lastClickedRef.current = index;
    },
    [users, relationshipUris, selectUser, deselectUser, isSelected],
  );

  return { handleRangeSelect };
}
