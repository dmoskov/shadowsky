import { AppBskyActorDefs } from "@atproto/api";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInfiniteScroll } from "../hooks/useRAFScroll";
import { useMinDuration } from "../hooks/useTiming";
import { proxifyBskyImage } from "../utils/image-proxy";
import { DomainVerifiedBadgeInline } from "./ui/DomainVerifiedBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { UserListSkeleton } from "./ui/SkeletonLoader";

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actor: string;
  type: "followers" | "following";
}

export function UserListModal({
  isOpen,
  onClose,
  title,
  actor,
  type,
}: UserListModalProps) {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [loadingRaw, setLoadingRaw] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Apply minimum duration to prevent loading flash
  const loading = useMinDuration(loadingRaw, 300);

  // Accessibility: Focus trap and unique ID for aria-labelledby
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && agent) {
      loadUsers(true);
    }
  }, [isOpen, actor, type, agent]);

  const loadUsers = async (initial = false) => {
    if (!agent || (!initial && (!hasMore || loadingMore))) return;

    try {
      if (initial) {
        setLoadingRaw(true);
        setUsers([]);
      } else {
        setLoadingMore(true);
      }

      if (type === "followers") {
        const response = await agent.getFollowers({
          actor,
          limit: 50,
          cursor: initial ? undefined : cursor,
        });

        if (response.data) {
          setUsers((prev) =>
            initial
              ? response.data.followers
              : [...prev, ...response.data.followers],
          );
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        }
      } else {
        const response = await agent.getFollows({
          actor,
          limit: 50,
          cursor: initial ? undefined : cursor,
        });

        if (response.data) {
          setUsers((prev) =>
            initial
              ? response.data.follows
              : [...prev, ...response.data.follows],
          );
          setCursor(response.data.cursor);
          setHasMore(!!response.data.cursor);
        }
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoadingRaw(false);
      setLoadingMore(false);
    }
  };

  const handleUserClick = useCallback(
    (handle: string) => {
      navigate(`/profile/${handle}`);
      onClose();
    },
    [navigate, onClose],
  );

  // Use RAF-batched infinite scroll
  const { ref: infiniteScrollRef } = useInfiniteScroll({
    onLoadMore: () => loadUsers(),
    hasMore,
    isLoading: loadingMore,
    threshold: 100,
  });

  // Keyboard navigation handler for the modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (users.length > 0) {
            setFocusedIndex((prev) =>
              prev < users.length - 1 ? prev + 1 : prev,
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (users.length > 0) {
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          }
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < users.length) {
            e.preventDefault();
            handleUserClick(users[focusedIndex].handle);
          }
          break;
        case "Home":
          if (users.length > 0) {
            e.preventDefault();
            setFocusedIndex(0);
          }
          break;
        case "End":
          if (users.length > 0) {
            e.preventDefault();
            setFocusedIndex(users.length - 1);
          }
          break;
      }
    },
    [users, focusedIndex, onClose, handleUserClick],
  );

  // Reset focus index when modal opens or users change
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const listItems = listRef.current.querySelectorAll('[role="option"]');
      const focusedItem = listItems[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedIndex]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-container modal-auto-height modal-md bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* User list */}
        <div
          ref={(el) => {
            // Combine refs for keyboard navigation and infinite scroll
            (listRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            infiniteScrollRef(el);
          }}
          className="max-h-[calc(80vh-73px)] overflow-y-auto"
          role="listbox"
          aria-label={`${title} list`}
          tabIndex={0}
        >
          {loading ? (
            <UserListSkeleton count={5} aria-label="Loading users" />
          ) : users.length === 0 ? (
            <div
              className="p-8 text-center text-gray-500 dark:text-gray-400"
              role="status"
            >
              No {type} yet
            </div>
          ) : (
            <>
              {users.map((user, index) => (
                <div
                  key={user.did}
                  role="option"
                  aria-selected={index === focusedIndex}
                  tabIndex={index === focusedIndex ? 0 : -1}
                  className={`flex cursor-pointer items-center gap-3 border-b p-4 outline-none dark:border-gray-700 ${
                    index === focusedIndex
                      ? "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => handleUserClick(user.handle)}
                  onFocus={() => setFocusedIndex(index)}
                >
                  <ProfileHoverCard handle={user.handle}>
                    <img
                      src={
                        user.avatar
                          ? proxifyBskyImage(user.avatar)
                          : "/default-avatar.svg"
                      }
                      alt=""
                      aria-hidden="true"
                      className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    />
                  </ProfileHoverCard>
                  <div className="flex-1">
                    <ProfileHoverCard handle={user.handle}>
                      <div className="cursor-pointer font-medium hover:underline">
                        {user.displayName || user.handle}
                      </div>
                    </ProfileHoverCard>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <ProfileHoverCard handle={user.handle}>
                        <span className="cursor-pointer hover:underline">
                          @{user.handle}
                        </span>
                      </ProfileHoverCard>
                      <DomainVerifiedBadgeInline handle={user.handle} />
                    </div>
                    {user.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                        {user.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loadingMore && (
                <div className="flex justify-center p-4" aria-live="polite">
                  <div
                    className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"
                    aria-label="Loading more users"
                  ></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
