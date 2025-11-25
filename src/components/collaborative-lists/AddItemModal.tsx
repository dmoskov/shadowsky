import { AppBskyActorDefs, AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { Hash, Search, Sparkles, User, X } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  CollaborativeList,
  getItemTypeDisplayName,
  ListItemType,
} from "../../types/collaborative-list";

interface AddItemModalProps {
  list: CollaborativeList;
  onClose: () => void;
  onAdd: (targetUri: string, note?: string) => Promise<void>;
}

const ITEM_TYPE_ICONS: Record<ListItemType, React.ReactNode> = {
  account: <User className="h-5 w-5" />,
  post: <Sparkles className="h-5 w-5" />,
  topic: <Hash className="h-5 w-5" />,
};

export const AddItemModal: React.FC<AddItemModalProps> = ({
  list,
  onClose,
  onAdd,
}) => {
  const { agent } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [note, setNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Search for accounts
  const { data: accountResults, isLoading: accountsLoading } = useQuery({
    queryKey: ["searchAccounts", searchQuery],
    queryFn: async () => {
      if (!agent || !searchQuery.trim() || list.itemType !== "account") {
        return [];
      }

      try {
        const response = await agent.searchActors({
          term: searchQuery,
          limit: 10,
        });
        return response.data.actors;
      } catch {
        return [];
      }
    },
    enabled: !!agent && !!searchQuery.trim() && list.itemType === "account",
    staleTime: 30000,
  });

  // Search for posts (simplified - just searches recent posts)
  const { data: postResults, isLoading: postsLoading } = useQuery({
    queryKey: ["searchPosts", searchQuery],
    queryFn: async () => {
      if (!agent || !searchQuery.trim() || list.itemType !== "post") {
        return [];
      }

      try {
        // For now, just get user's timeline as an example
        // In a real implementation, we'd use a proper search API
        const response = await agent.getTimeline({ limit: 20 });
        const query = searchQuery.toLowerCase();
        return response.data.feed.filter((item) =>
          (item.post.record as { text?: string })?.text
            ?.toLowerCase()
            .includes(query),
        );
      } catch {
        return [];
      }
    },
    enabled: !!agent && !!searchQuery.trim() && list.itemType === "post",
    staleTime: 30000,
  });

  const handleAdd = useCallback(async () => {
    if (!selectedItem) {
      setError("Please select an item to add");
      return;
    }

    try {
      setIsAdding(true);
      setError(null);
      await onAdd(selectedItem, note.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAdding(false);
    }
  }, [selectedItem, note, onAdd]);

  const handleDirectAdd = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a value");
      return;
    }

    let targetUri = searchQuery.trim();

    // For topics, just use the hashtag
    if (list.itemType === "topic") {
      targetUri = searchQuery.trim().replace(/^#/, "");
    }

    try {
      setIsAdding(true);
      setError(null);
      await onAdd(targetUri, note.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  const renderAccountItem = (actor: AppBskyActorDefs.ProfileView) => {
    const isSelected = selectedItem === actor.did;
    return (
      <button
        key={actor.did}
        onClick={() => setSelectedItem(isSelected ? null : actor.did)}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 ${
          isSelected
            ? "bg-bsky-primary/10 border-bsky-primary"
            : "hover:border-bsky-primary/50 border-bsky-border-primary bg-bsky-bg-secondary"
        }`}
      >
        {actor.avatar ? (
          <img src={actor.avatar} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bsky-bg-tertiary text-bsky-text-secondary">
            <User className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <div className="truncate font-medium text-bsky-text-primary">
            {actor.displayName || actor.handle}
          </div>
          <div className="truncate text-sm text-bsky-text-secondary">
            @{actor.handle}
          </div>
        </div>
      </button>
    );
  };

  const renderPostItem = (feedItem: AppBskyFeedDefs.FeedViewPost) => {
    const post = feedItem.post;
    const isSelected = selectedItem === post.uri;
    const text = (post.record as { text?: string })?.text || "";

    return (
      <button
        key={post.uri}
        onClick={() => setSelectedItem(isSelected ? null : post.uri)}
        className={`flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-all duration-200 ${
          isSelected
            ? "bg-bsky-primary/10 border-bsky-primary"
            : "hover:border-bsky-primary/50 border-bsky-border-primary bg-bsky-bg-secondary"
        }`}
      >
        <div className="flex items-center gap-2">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt=""
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bsky-bg-tertiary text-bsky-text-secondary">
              <User className="h-3 w-3" />
            </div>
          )}
          <span className="text-sm font-medium text-bsky-text-primary">
            {post.author.displayName || post.author.handle}
          </span>
          <span className="text-sm text-bsky-text-secondary">
            @{post.author.handle}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-bsky-text-primary">{text}</p>
      </button>
    );
  };

  const isLoading = accountsLoading || postsLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-bsky-bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bsky-border-primary p-6">
          <div className="flex items-center gap-2">
            {ITEM_TYPE_ICONS[list.itemType]}
            <h3 className="m-0 text-lg font-semibold text-bsky-text-primary">
              Add {getItemTypeDisplayName(list.itemType).slice(0, -1)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bsky-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  list.itemType === "account"
                    ? "Search for accounts..."
                    : list.itemType === "post"
                      ? "Search for posts..."
                      : "Enter a hashtag or topic..."
                }
                className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary py-2 pl-10 pr-3 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Search Results */}
          {list.itemType === "account" && (
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
                </div>
              ) : accountResults && accountResults.length > 0 ? (
                accountResults.map(renderAccountItem)
              ) : searchQuery.trim() ? (
                <p className="py-4 text-center text-sm text-bsky-text-secondary">
                  No accounts found
                </p>
              ) : (
                <p className="py-4 text-center text-sm text-bsky-text-secondary">
                  Start typing to search for accounts
                </p>
              )}
            </div>
          )}

          {list.itemType === "post" && (
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
                </div>
              ) : postResults && postResults.length > 0 ? (
                postResults.map(renderPostItem)
              ) : searchQuery.trim() ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-bsky-text-secondary">
                    No matching posts found in your timeline
                  </p>
                  <p className="mt-2 text-xs text-bsky-text-tertiary">
                    You can also paste a post URL directly
                  </p>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-bsky-text-secondary">
                  Start typing to search for posts
                </p>
              )}
            </div>
          )}

          {list.itemType === "topic" && (
            <div className="space-y-4">
              <p className="text-sm text-bsky-text-secondary">
                Enter a hashtag or topic to add to this list.
              </p>
              {searchQuery.trim() && (
                <div
                  onClick={() => setSelectedItem(searchQuery.trim())}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-all duration-200 ${
                    selectedItem === searchQuery.trim()
                      ? "bg-bsky-primary/10 border-bsky-primary"
                      : "hover:border-bsky-primary/50 border-bsky-border-primary bg-bsky-bg-secondary"
                  }`}
                >
                  <Hash className="h-5 w-5 text-bsky-text-secondary" />
                  <span className="font-medium text-bsky-text-primary">
                    #{searchQuery.trim().replace(/^#/, "")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Note Input */}
          {selectedItem && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-bsky-text-primary">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this item..."
                maxLength={200}
                className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-bsky-border-primary p-6">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-bsky-border-primary bg-transparent px-4 py-2 text-sm font-medium text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            Cancel
          </button>
          {list.itemType === "topic" ? (
            <button
              onClick={handleDirectAdd}
              disabled={isAdding || !searchQuery.trim()}
              className="cursor-pointer rounded-lg border-none bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add Topic"}
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={isAdding || !selectedItem}
              className="cursor-pointer rounded-lg border-none bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add to List"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
