import { AppBskyFeedDefs } from "@atproto/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Edit2,
  Eye,
  Globe,
  Hash,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { collaborativeListService } from "../../services/collaborative-list-service";
import {
  getItemTypeDisplayName,
  getRoleDisplayName,
  hasPermission,
  ListItem,
  ListItemType,
} from "../../types/collaborative-list";
import { PostCard } from "../PostCard";
import { ThreadModal } from "../ThreadModal";
import { AddItemModal } from "./AddItemModal";
import { EditCollaborativeListModal } from "./EditCollaborativeListModal";
import { ManageCollaboratorsModal } from "./ManageCollaboratorsModal";

const ITEM_TYPE_ICONS: Record<ListItemType, React.ReactNode> = {
  account: <User className="h-5 w-5" />,
  post: <Sparkles className="h-5 w-5" />,
  topic: <Hash className="h-5 w-5" />,
};

const scrollPositions = new Map<string, number>();

export const CollaborativeListDetail: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const { agent } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showConfirm } = useModal();

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);

  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 200,
    key: listId,
  });

  // Fetch list details
  const {
    data: list,
    isLoading: listLoading,
    error: listError,
  } = useQuery({
    queryKey: ["collaborativeList", listId],
    queryFn: async () => {
      if (!agent || !listId) {
        throw new Error("Not authenticated or no list ID");
      }
      await collaborativeListService.initialize(agent);
      return collaborativeListService.getList(listId);
    },
    enabled: !!agent && !!listId,
  });

  // Fetch list items
  const {
    data: items,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ["collaborativeListItems", listId],
    queryFn: async () => {
      if (!agent || !listId) {
        throw new Error("Not authenticated or no list ID");
      }
      await collaborativeListService.initialize(agent);
      return collaborativeListService.getItems(listId);
    },
    enabled: !!agent && !!listId,
  });

  // Fetch user role
  const { data: userRole } = useQuery({
    queryKey: ["collaborativeListUserRole", listId],
    queryFn: async () => {
      if (!agent || !listId) {
        throw new Error("Not authenticated or no list ID");
      }
      await collaborativeListService.initialize(agent);
      return collaborativeListService.getUserRole(listId);
    },
    enabled: !!agent && !!listId,
  });

  // Fetch posts for post-type items
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["collaborativeListPosts", listId, items],
    queryFn: async () => {
      if (!agent || !items || list?.itemType !== "post") return [];

      const postUris = items.map((item) => item.targetUri).filter(Boolean);
      if (postUris.length === 0) return [];

      try {
        const response = await agent.getPosts({ uris: postUris });
        return response.data.posts;
      } catch {
        return [];
      }
    },
    enabled: !!agent && !!items && list?.itemType === "post",
  });

  // Fetch profiles for account-type items
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["collaborativeListProfiles", listId, items],
    queryFn: async () => {
      if (!agent || !items || list?.itemType !== "account") return [];

      const dids = items.map((item) => item.targetUri).filter(Boolean);
      if (dids.length === 0) return [];

      try {
        const response = await agent.getProfiles({ actors: dids.slice(0, 25) });
        return response.data.profiles;
      } catch {
        return [];
      }
    },
    enabled: !!agent && !!items && list?.itemType === "account",
  });

  // Measure container height for virtual list
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Restore scroll position
  useEffect(() => {
    if (
      shouldRestoreScroll &&
      listId &&
      items &&
      items.length > 0 &&
      scrollPositions.has(listId) &&
      listRef.current
    ) {
      const savedPosition = scrollPositions.get(listId)!;
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({ index: 0, behavior: "auto" });
          const element = listRef.current.element;
          if (element) {
            element.scrollTop = savedPosition;
          }
        }
      }, 0);
      setShouldRestoreScroll(false);
    }
  }, [listId, items?.length, shouldRestoreScroll]);

  useEffect(() => {
    if (listId && scrollPositions.has(listId)) {
      setShouldRestoreScroll(true);
    }
  }, [listId]);

  useEffect(() => {
    return () => {
      if (listId && listRef.current) {
        const element = listRef.current.element;
        if (element) {
          scrollPositions.set(listId, element.scrollTop);
        }
      }
    };
  }, [listId]);

  const handleRefresh = useCallback(() => {
    refetchItems();
    queryClient.invalidateQueries({ queryKey: ["collaborativeList", listId] });
  }, [refetchItems, queryClient, listId]);

  const handleAddItem = async (targetUri: string, note?: string) => {
    if (!agent || !listId || !list) return;

    try {
      await collaborativeListService.addItem({
        listId,
        type: list.itemType,
        targetUri,
        note,
      });
      refetchItems();
      queryClient.invalidateQueries({
        queryKey: ["collaborativeList", listId],
      });
      setShowAddItemModal(false);
    } catch (err) {
      throw err;
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!agent || !listId) return;

    await showConfirm(
      "Are you sure you want to remove this item from the list?",
      async () => {
        try {
          await collaborativeListService.removeItem(listId, itemId);
          refetchItems();
          queryClient.invalidateQueries({
            queryKey: ["collaborativeList", listId],
          });
        } catch {
          // Error handled by service
        }
      },
      {
        variant: "warning",
        title: "Remove Item",
        confirmText: "Remove",
        cancelText: "Cancel",
      },
    );
  };

  const handleDeleteList = async () => {
    if (!list) return;

    await showConfirm(
      `Are you sure you want to delete "${list.name}"? This will remove all items and cannot be undone.`,
      async () => {
        try {
          await collaborativeListService.deleteList(list.id);
          navigate("/collaborative-lists");
        } catch {
          // Error handled by service
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

  const canEdit = userRole && hasPermission(userRole, "canEditListDetails");
  const canAddItems = userRole && hasPermission(userRole, "canAddItems");
  const canRemoveItems = userRole && hasPermission(userRole, "canRemoveItems");
  const canDelete = userRole && hasPermission(userRole, "canDeleteList");
  const canManageCollaborators =
    userRole && hasPermission(userRole, "canInviteCollaborators");

  const isLoading = listLoading || itemsLoading;

  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-bsky-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
      </div>
    );
  }

  if (listError || !list) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-bsky-bg-primary p-8 text-center">
        <p className="text-bsky-text-primary">List not found</p>
        <button
          onClick={() => navigate("/collaborative-lists")}
          className="mt-4 cursor-pointer rounded-lg bg-bsky-primary px-4 py-2 text-white transition-all duration-200 hover:opacity-90"
        >
          Back to Lists
        </button>
      </div>
    );
  }

  const renderItem = (item: ListItem, _index: number) => {
    if (list.itemType === "post" && posts) {
      const post = posts.find((p) => p.uri === item.targetUri);
      if (post) {
        return (
          <div className="relative">
            <PostCard
              post={post}
              onClick={() => {
                setSelectedPost(post);
                setShowThread(true);
              }}
            />
            {canRemoveItems && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveItem(item.id);
                }}
                className="absolute right-2 top-2 cursor-pointer rounded-full bg-red-500/80 p-1.5 text-white opacity-0 transition-opacity duration-200 hover:bg-red-600 group-hover:opacity-100"
                title="Remove from list"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      }
    }

    if (list.itemType === "account" && profiles) {
      const profile = profiles.find((p) => p.did === item.targetUri);
      if (profile) {
        return (
          <div
            className="group flex items-center justify-between border-b border-bsky-border-primary p-4 transition-colors hover:bg-bsky-bg-secondary"
            onClick={() => navigate(`/profile/${profile.handle}`)}
          >
            <div className="flex items-center gap-3">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bsky-bg-tertiary text-bsky-text-secondary">
                  <User className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="font-medium text-bsky-text-primary">
                  {profile.displayName || profile.handle}
                </div>
                <div className="text-sm text-bsky-text-secondary">
                  @{profile.handle}
                </div>
                {profile.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-bsky-text-tertiary">
                    {profile.description}
                  </p>
                )}
              </div>
            </div>
            {canRemoveItems && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveItem(item.id);
                }}
                className="cursor-pointer rounded-full bg-red-500/80 p-2 text-white opacity-0 transition-opacity duration-200 hover:bg-red-600 group-hover:opacity-100"
                title="Remove from list"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      }
    }

    // Default item display
    return (
      <div className="group flex items-center justify-between border-b border-bsky-border-primary p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-bsky-bg-tertiary p-2 text-bsky-text-secondary">
            {ITEM_TYPE_ICONS[item.type]}
          </div>
          <div>
            <div className="font-medium text-bsky-text-primary">
              {item.targetUri}
            </div>
            {item.note && (
              <p className="mt-1 text-sm text-bsky-text-secondary">
                {item.note}
              </p>
            )}
            <p className="text-xs text-bsky-text-tertiary">
              Added{" "}
              {formatDistanceToNow(new Date(item.addedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        {canRemoveItems && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveItem(item.id);
            }}
            className="cursor-pointer rounded-full bg-red-500/80 p-2 text-white opacity-0 transition-opacity duration-200 hover:bg-red-600 group-hover:opacity-100"
            title="Remove from list"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-bsky-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-bsky-border-primary bg-bsky-bg-primary p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/collaborative-lists")}
            className="cursor-pointer rounded-full p-2 transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <ArrowLeft className="h-5 w-5 text-bsky-text-primary" />
          </button>

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
              <h2 className="m-0 text-xl font-semibold text-bsky-text-primary">
                {list.name}
              </h2>
              {list.visibility === "private" ? (
                <Lock className="h-4 w-4 text-bsky-text-tertiary" />
              ) : (
                <Globe className="h-4 w-4 text-bsky-text-tertiary" />
              )}
            </div>

            {list.description && (
              <p className="mt-1 text-sm text-bsky-text-secondary">
                {list.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-bsky-text-tertiary">
              <span>
                {list.itemCount}{" "}
                {getItemTypeDisplayName(list.itemType).toLowerCase()}
              </span>
              <span>{list.collaboratorCount} collaborators</span>
              <span>{list.followerCount} followers</span>
              {userRole && (
                <span className="rounded-full bg-bsky-bg-secondary px-2 py-0.5 text-xs">
                  {getRoleDisplayName(userRole)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canAddItems && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-bsky-primary px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            )}

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="cursor-pointer rounded-full p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary disabled:opacity-50"
            >
              <RefreshCw
                className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="cursor-pointer rounded-full p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-lg border border-bsky-border-primary bg-bsky-bg-primary shadow-xl">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Details
                      </button>
                    )}
                    {canManageCollaborators && (
                      <button
                        onClick={() => {
                          setShowCollaboratorsModal(true);
                          setShowMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                      >
                        <UserPlus className="h-4 w-4" />
                        Manage Collaborators
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowCollaboratorsModal(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                    >
                      <Users className="h-4 w-4" />
                      View Collaborators
                    </button>
                    <button
                      onClick={() => setShowMenu(false)}
                      className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-hover"
                    >
                      <Eye className="h-4 w-4" />
                      {list.followerCount} Followers
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          handleDeleteList();
                          setShowMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2.5 text-left text-sm text-red-600 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete List
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {itemsLoading || postsLoading || profilesLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-bsky-border-primary border-t-bsky-primary" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            {ITEM_TYPE_ICONS[list.itemType]}
            <p className="mt-4 text-bsky-text-secondary">
              No {getItemTypeDisplayName(list.itemType).toLowerCase()} in this
              list yet
            </p>
            {canAddItems && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="mt-4 flex cursor-pointer items-center gap-2 rounded-full bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add First{" "}
                {list.itemType === "account"
                  ? "Account"
                  : list.itemType === "post"
                    ? "Post"
                    : "Topic"}
              </button>
            )}
          </div>
        ) : (
          <List
            listRef={listRef}
            rowCount={items.length}
            rowHeight={dynamicRowHeight}
            defaultHeight={containerHeight}
            overscanCount={5}
            rowComponent={({ index, style }) => {
              const item = items[index];
              return (
                <div style={style} className="group">
                  {renderItem(item, index)}
                </div>
              );
            }}
            rowProps={{}}
          />
        )}
      </div>

      {/* Modals */}
      {showAddItemModal && (
        <AddItemModal
          list={list}
          onClose={() => setShowAddItemModal(false)}
          onAdd={handleAddItem}
        />
      )}

      {showEditModal && (
        <EditCollaborativeListModal
          list={list}
          onClose={() => setShowEditModal(false)}
          onUpdate={async (id, updates) => {
            await collaborativeListService.updateList(id, updates);
            queryClient.invalidateQueries({
              queryKey: ["collaborativeList", listId],
            });
            setShowEditModal(false);
          }}
        />
      )}

      {showCollaboratorsModal && (
        <ManageCollaboratorsModal
          list={list}
          onClose={() => setShowCollaboratorsModal(false)}
          onUpdate={() => {
            queryClient.invalidateQueries({
              queryKey: ["collaborativeList", listId],
            });
          }}
        />
      )}

      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
          }}
        />
      )}
    </div>
  );
};
