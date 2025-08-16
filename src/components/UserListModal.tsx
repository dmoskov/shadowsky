import { AppBskyActorDefs } from "@atproto/api";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { proxifyBskyImage } from "../utils/image-proxy";

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
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (isOpen && agent) {
      loadUsers(true);
    }
  }, [isOpen, actor, type, agent]);

  const loadUsers = async (initial = false) => {
    if (!agent || (!initial && (!hasMore || loadingMore))) return;

    try {
      if (initial) {
        setLoading(true);
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
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleUserClick = (handle: string) => {
    navigate(`/profile/${handle}`);
    onClose();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (
      element.scrollHeight - element.scrollTop <= element.clientHeight + 100 &&
      hasMore &&
      !loadingMore
    ) {
      loadUsers();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User list */}
        <div
          className="max-h-[calc(80vh-73px)] overflow-y-auto"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No {type} yet
            </div>
          ) : (
            <>
              {users.map((user) => (
                <div
                  key={user.did}
                  className="flex cursor-pointer items-center gap-3 border-b p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  onClick={() => handleUserClick(user.handle)}
                >
                  <img
                    src={
                      user.avatar
                        ? proxifyBskyImage(user.avatar)
                        : "/default-avatar.svg"
                    }
                    alt={user.displayName || user.handle}
                    className="h-12 w-12 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {user.displayName || user.handle}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      @{user.handle}
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
                <div className="flex justify-center p-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
