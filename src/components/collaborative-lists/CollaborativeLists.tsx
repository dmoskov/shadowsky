import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Edit2,
  Eye,
  Globe,
  Hash,
  Lock,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
  User,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { collaborativeListService } from "../../services/collaborative-list-service";
import {
  CollaborativeList,
  CreateCollaborativeListRequest,
  getItemTypeDisplayName,
  ListItemType,
  UpdateCollaborativeListRequest,
} from "../../types/collaborative-list";
import { CreateCollaborativeListModal } from "./CreateCollaborativeListModal";
import { EditCollaborativeListModal } from "./EditCollaborativeListModal";
import { ManageCollaboratorsModal } from "./ManageCollaboratorsModal";

const ITEM_TYPE_ICONS: Record<ListItemType, React.ReactNode> = {
  account: <User className="h-4 w-4" />,
  post: <Sparkles className="h-4 w-4" />,
  topic: <Hash className="h-4 w-4" />,
};

export const CollaborativeLists: React.FC = () => {
  const { agent } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showConfirm } = useModal();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingList, setEditingList] = useState<CollaborativeList | null>(null);
  const [managingCollaborators, setManagingCollaborators] = useState<CollaborativeList | null>(null);
  const [menuOpenForList, setMenuOpenForList] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ListItemType | "all">("all");

  const {
    data: lists,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["collaborativeLists"],
    queryFn: async () => {
      if (!agent) {
        throw new Error("Not authenticated");
      }
      await collaborativeListService.initialize(agent);
      return collaborativeListService.getMyLists();
    },
    enabled: !!agent,
  });

  const filteredLists = lists?.filter(
    (list) => filterType === "all" || list.itemType === filterType
  );

  const handleCreateList = async (request: CreateCollaborativeListRequest) => {
    if (!agent) return;

    try {
      await collaborativeListService.initialize(agent);
      await collaborativeListService.createList(request);
      queryClient.invalidateQueries({ queryKey: ["collaborativeLists"] });
      setShowCreateModal(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateList = async (
    listId: string,
    updates: UpdateCollaborativeListRequest
  ) => {
    try {
      if (!agent) return;
      await collaborativeListService.initialize(agent);
      await collaborativeListService.updateList(listId, updates);
      queryClient.invalidateQueries({ queryKey: ["collaborativeLists"] });
      setEditingList(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteList = async (list: CollaborativeList) => {
    await showConfirm(
      `Are you sure you want to delete "${list.name}"? This will remove all items and cannot be undone.`,
      async () => {
        try {
          if (!agent) return;
          await collaborativeListService.initialize(agent);
          await collaborativeListService.deleteList(list.id);
          queryClient.invalidateQueries({ queryKey: ["collaborativeLists"] });
        } catch (err) {
          // Error will be handled by the service
        }
      },
      {
        variant: "warning",
        title: "Delete Collaborative List",
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col bg-bsky-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-bsky-border-primary bg-bsky-bg-primary p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-bsky-text-primary" />
            <h2 className="m-0 text-xl font-semibold text-bsky-text-primary">
              Collaborative Lists
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

        {/* Filter Tabs */}
        {lists && lists.length > 0 && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`rounded-full px-3 py-1 text-sm transition-all duration-200 ${
                filterType === "all"
                  ? "bg-bsky-primary text-white"
                  : "bg-bsky-bg-secondary text-bsky-text-secondary hover:bg-bsky-bg-tertiary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("account")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-all duration-200 ${
                filterType === "account"
                  ? "bg-bsky-primary text-white"
                  : "bg-bsky-bg-secondary text-bsky-text-secondary hover:bg-bsky-bg-tertiary"
              }`}
            >
              <User className="h-3 w-3" />
              Accounts
            </button>
            <button
              onClick={() => setFilterType("post")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-all duration-200 ${
                filterType === "post"
                  ? "bg-bsky-primary text-white"
                  : "bg-bsky-bg-secondary text-bsky-text-secondary hover:bg-bsky-bg-tertiary"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Posts
            </button>
            <button
              onClick={() => setFilterType("topic")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-all duration-200 ${
                filterType === "topic"
                  ? "bg-bsky-primary text-white"
                  : "bg-bsky-bg-secondary text-bsky-text-secondary hover:bg-bsky-bg-tertiary"
              }`}
            >
              <Hash className="h-3 w-3" />
              Topics
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
          <p className="mt-4 text-bsky-text-secondary">Loading lists...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 text-center">
          <p className="text-red-500">
            Error loading lists: {(error as Error).message}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && lists?.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <Users className="h-12 w-12 text-gray-400" />
          <p className="mb-2 mt-4 text-base font-medium text-bsky-text-primary">
            No collaborative lists yet
          </p>
          <p className="mb-4 text-sm text-bsky-text-secondary">
            Create a list and invite others to curate content together
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

      {/* Lists Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredLists?.map((list) => (
            <div
              key={list.id}
              className="group relative cursor-pointer rounded-xl border border-bsky-border-primary bg-bsky-bg-secondary p-4 transition-all duration-200 hover:border-bsky-primary hover:shadow-lg"
              onClick={() => navigate(`/collaborative-lists/${encodeURIComponent(list.id)}`)}
            >
              {/* Header Row */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full p-1.5 ${
                        list.itemType === "account"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : list.itemType === "post"
                            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {ITEM_TYPE_ICONS[list.itemType]}
                    </span>
                    <h3 className="text-lg font-semibold text-bsky-text-primary">
                      {list.name}
                    </h3>
                    {list.visibility === "private" ? (
                      <Lock className="h-4 w-4 text-bsky-text-tertiary" />
                    ) : (
                      <Globe className="h-4 w-4 text-bsky-text-tertiary" />
                    )}
                  </div>
                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-bsky-text-secondary">
                      {list.description}
                    </p>
                  )}
                </div>

                {/* Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenForList(
                        menuOpenForList === list.id ? null : list.id
                      );
                    }}
                    className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-hover"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenForList === list.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenForList(null);
                        }}
                      />
                      <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-lg border border-bsky-border-primary bg-bsky-bg-primary shadow-xl">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingList(list);
                            setMenuOpenForList(null);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagingCollaborators(list);
                            setMenuOpenForList(null);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                        >
                          <Users className="h-4 w-4" />
                          Manage Collaborators
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list);
                            setMenuOpenForList(null);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-red-600 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tags */}
              {list.tags && list.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {list.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-bsky-bg-tertiary px-2 py-0.5 text-xs text-bsky-text-secondary"
                    >
                      #{tag}
                    </span>
                  ))}
                  {list.tags.length > 3 && (
                    <span className="text-xs text-bsky-text-tertiary">
                      +{list.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Stats Row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-bsky-text-secondary">
                    {ITEM_TYPE_ICONS[list.itemType]}
                    <span>
                      {list.itemCount} {getItemTypeDisplayName(list.itemType).toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-bsky-text-secondary">
                    <Users className="h-4 w-4" />
                    <span>
                      {list.collaboratorCount}{" "}
                      {list.collaboratorCount === 1 ? "collaborator" : "collaborators"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-bsky-text-secondary">
                    <Eye className="h-4 w-4" />
                    <span>
                      {list.followerCount}{" "}
                      {list.followerCount === 1 ? "follower" : "followers"}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-bsky-text-tertiary">
                  Updated{" "}
                  {formatDistanceToNow(new Date(list.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateCollaborativeListModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateList}
        />
      )}

      {editingList && (
        <EditCollaborativeListModal
          list={editingList}
          onClose={() => setEditingList(null)}
          onUpdate={handleUpdateList}
        />
      )}

      {managingCollaborators && (
        <ManageCollaboratorsModal
          list={managingCollaborators}
          onClose={() => setManagingCollaborators(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["collaborativeLists"] });
          }}
        />
      )}
    </div>
  );
};
