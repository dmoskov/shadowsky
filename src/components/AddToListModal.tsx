import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMinDuration } from "../hooks/useTiming";
import { blueskyListService } from "../services/bluesky-list-service";
import { ListItemSkeleton } from "./ui/SkeletonLoader";

interface AddToListModalProps {
  user: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  onClose: () => void;
}

export const AddToListModal: React.FC<AddToListModalProps> = ({
  user,
  onClose,
}) => {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const [updatingListUri, setUpdatingListUri] = useState<string | null>(null);

  const { data: lists, isLoading: isLoadingRaw } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      await blueskyListService.initialize(agent);
      return blueskyListService.getMyLists();
    },
    enabled: !!agent,
  });

  // Apply minimum duration to prevent loading flash
  const isLoading = useMinDuration(isLoadingRaw, 300);

  const { data: userListUris } = useQuery({
    queryKey: ["userLists", user.did],
    queryFn: async () => {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      await blueskyListService.initialize(agent);
      return blueskyListService.getListsContainingMember(user.did);
    },
    enabled: !!agent,
  });

  const isInList = (listUri: string) => {
    return userListUris?.includes(listUri) || false;
  };

  const handleToggleList = async (listUri: string) => {
    if (!agent || updatingListUri) return;

    setUpdatingListUri(listUri);
    try {
      await blueskyListService.initialize(agent);

      if (isInList(listUri)) {
        const members = await blueskyListService.getListMembers(listUri);
        const memberItem = members.find((m) => m.subject.did === user.did);
        if (memberItem) {
          await blueskyListService.removeMemberFromList(memberItem.uri);
        }
      } else {
        await blueskyListService.addMemberToList(listUri, user.did);
      }

      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", listUri] });
      queryClient.invalidateQueries({ queryKey: ["listMembers", listUri] });
      queryClient.invalidateQueries({ queryKey: ["userLists", user.did] });
    } catch (error) {
      console.error("Failed to update list:", error);
    } finally {
      setUpdatingListUri(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-auto-height modal-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bsky-border-primary p-6">
          <h3 className="m-0 text-lg font-semibold text-bsky-text-primary">
            Add to Lists
          </h3>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4">
          {isLoading && <ListItemSkeleton count={3} aria-label="Loading lists" />}

          {!isLoading && lists && lists.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-bsky-text-secondary">
                No lists yet. Create a list first!
              </p>
            </div>
          )}

          {!isLoading && lists && lists.length > 0 && (
            <div className="space-y-2">
              {lists.map((list) => {
                const inList = isInList(list.uri);
                const isUpdating = updatingListUri === list.uri;

                return (
                  <button
                    key={list.uri}
                    onClick={() => handleToggleList(list.uri)}
                    disabled={isUpdating}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-3 text-left transition-all duration-200 hover:border-bsky-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-bsky-text-primary">
                        {list.name}
                      </div>
                      {list.description && (
                        <div className="mt-1 line-clamp-1 text-sm text-bsky-text-secondary">
                          {list.description}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-bsky-text-tertiary">
                        {list.listItemCount || 0}{" "}
                        {list.listItemCount === 1 ? "member" : "members"}
                      </div>
                    </div>
                    <div className="ml-3">
                      {isUpdating ? (
                        <div className="border-t-bsky-accent-primary h-5 w-5 animate-spin rounded-full border-2 border-bsky-border-primary" />
                      ) : inList ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bsky-primary">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-bsky-border-primary">
                          <Plus className="h-4 w-4 text-bsky-text-secondary" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
