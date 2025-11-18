import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { listStorage } from "../services/list-storage";
import { ListMember } from "../types/lists";

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
  const [updatingListId, setUpdatingListId] = useState<string | null>(null);

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      await listStorage.initialize(agent);
      return listStorage.getAllLists();
    },
    enabled: !!agent,
  });

  const { data: userLists } = useQuery({
    queryKey: ["userLists", user.did],
    queryFn: async () => {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      await listStorage.initialize(agent);
      return listStorage.getListsContainingMember(user.did);
    },
    enabled: !!agent,
  });

  const isInList = (listId: string) => {
    return userLists?.some((list) => list.id === listId) || false;
  };

  const handleToggleList = async (listId: string) => {
    if (!agent || updatingListId) return;

    setUpdatingListId(listId);
    try {
      await listStorage.initialize(agent);

      if (isInList(listId)) {
        await listStorage.removeMemberFromList(listId, user.did);
      } else {
        const member: ListMember = {
          did: user.did,
          handle: user.handle,
          displayName: user.displayName,
          avatar: user.avatar,
          addedAt: new Date().toISOString(),
        };
        await listStorage.addMemberToList(listId, member);
      }

      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["userLists", user.did] });
    } catch (error) {
      console.error("Failed to update list:", error);
    } finally {
      setUpdatingListId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="w-11/12 max-w-md rounded-xl bg-bsky-bg-primary shadow-xl"
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
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="border-t-bsky-accent-primary h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary" />
            </div>
          )}

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
                const inList = isInList(list.id);
                const isUpdating = updatingListId === list.id;

                return (
                  <button
                    key={list.id}
                    onClick={() => handleToggleList(list.id)}
                    disabled={isUpdating}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-3 text-left transition-all duration-200 hover:border-bsky-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-bsky-text-primary">
                        {list.name}
                      </div>
                      {list.description && (
                        <div className="mt-1 text-sm text-bsky-text-secondary line-clamp-1">
                          {list.description}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-bsky-text-tertiary">
                        {list.members.length}{" "}
                        {list.members.length === 1 ? "member" : "members"}
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
