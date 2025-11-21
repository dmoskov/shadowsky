import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Edit2,
  List as ListIcon,
  MoreVertical,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useModal } from "../contexts/ModalContext";
import {
  BlueskyList,
  blueskyListService,
} from "../services/bluesky-list-service";
import { CreateListModal } from "./CreateListModal";
import { EditListModal } from "./EditListModal";

export const Lists: React.FC = () => {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showConfirm } = useModal();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingList, setEditingList] = useState<BlueskyList | null>(null);
  const [menuOpenForList, setMenuOpenForList] = useState<string | null>(null);

  const {
    data: lists,
    isLoading,
    error,
  } = useQuery({
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

  const handleCreateList = async (name: string, description?: string) => {
    if (!agent) return;

    try {
      await blueskyListService.initialize(agent);
      await blueskyListService.createList(name, description);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create list:", error);
      throw error;
    }
  };

  const handleDeleteList = async (listUri: string) => {
    await showConfirm(
      "Are you sure you want to delete this list? This cannot be undone.",
      async () => {
        try {
          if (!agent) return;
          await blueskyListService.initialize(agent);
          await blueskyListService.deleteList(listUri);
          queryClient.invalidateQueries({ queryKey: ["lists"] });
        } catch (error) {
          console.error("Failed to delete list:", error);
        }
      },
      {
        variant: "warning",
        title: "Delete List",
        confirmText: "Delete",
        cancelText: "Cancel",
      },
    );
  };

  const handleUpdateList = async (
    listUri: string,
    updates: { name?: string; description?: string },
  ) => {
    try {
      if (!agent) return;
      await blueskyListService.initialize(agent);
      await blueskyListService.updateList(listUri, updates);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setEditingList(null);
    } catch (error) {
      console.error("Failed to update list:", error);
      throw error;
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col bg-bsky-bg-primary">
      <div className="sticky top-0 z-10 border-b border-bsky-border-primary bg-bsky-bg-primary p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListIcon className="h-5 w-5 text-bsky-text-primary" />
            <h2 className="m-0 text-xl font-semibold text-bsky-text-primary">
              Lists
            </h2>
            {lists && lists.length > 0 && (
              <span className="rounded-full bg-bsky-bg-secondary px-2 py-0.5 text-sm text-bsky-text-secondary">
                {lists.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New List
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div className="border-t-bsky-accent-primary h-8 w-8 animate-spin rounded-full border-2 border-bsky-border-primary" />
          <p className="mt-4 text-bsky-text-secondary">Loading lists...</p>
        </div>
      )}

      {error && (
        <div className="p-4 text-center">
          <p className="text-red-500">
            Error loading lists: {(error as Error).message}
          </p>
        </div>
      )}

      {!isLoading && !error && lists?.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <ListIcon className="h-12 w-12 text-gray-400" />
          <p className="mb-2 mt-4 text-base font-medium text-bsky-text-primary">
            No lists yet
          </p>
          <p className="mb-4 text-sm text-bsky-text-secondary">
            Create lists to organize accounts into custom groups
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Your First List
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {lists?.map((list) => (
            <div
              key={list.uri}
              className="group relative cursor-pointer rounded-xl border border-bsky-border-primary bg-bsky-bg-secondary p-4 transition-all duration-200 hover:border-bsky-primary hover:shadow-lg"
              onClick={() => navigate(`/lists/${encodeURIComponent(list.uri)}`)}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-bsky-text-primary">
                    {list.name}
                  </h3>
                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-bsky-text-secondary">
                      {list.description}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenForList(
                        menuOpenForList === list.uri ? null : list.uri,
                      );
                    }}
                    className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-hover"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenForList === list.uri && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenForList(null);
                        }}
                      />
                      <div className="absolute right-0 top-10 z-20 min-w-[160px] rounded-lg border border-bsky-border-primary bg-bsky-bg-primary shadow-xl">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingList(list);
                            setMenuOpenForList(null);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.uri);
                            setMenuOpenForList(null);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-red-600 transition-all duration-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-bsky-text-secondary">
                  <Users className="h-4 w-4" />
                  <span>
                    {list.listItemCount || 0}{" "}
                    {list.listItemCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <span className="text-xs text-bsky-text-tertiary">
                  Updated{" "}
                  {formatDistanceToNow(new Date(list.indexedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <CreateListModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateList}
        />
      )}

      {editingList && (
        <EditListModal
          list={editingList}
          onClose={() => setEditingList(null)}
          onUpdate={handleUpdateList}
        />
      )}
    </div>
  );
};
