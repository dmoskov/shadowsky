import { Edit2, Folder, MoreVertical, Plus, Trash2, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useModal } from "../../contexts/ModalContext";
import { useBookmarkCollections } from "../../hooks/useBookmarkCollections";
import type { BookmarkCollection } from "../../services/bookmark-collections";
import { COLLECTION_COLORS } from "../../services/bookmark-collections";

interface CollectionManagerProps {
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  onClose?: () => void;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  selectedCollectionId,
  onSelectCollection,
  onClose,
}) => {
  const { showDestructiveConfirm } = useModal();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<BookmarkCollection | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    collections,
    createCollection,
    updateCollection,
    deleteCollection,
    isCreating,
    isUpdating,
    isDeleting,
  } = useBookmarkCollections();

  // Focus input when showing form
  useEffect(() => {
    if ((showCreateForm || editingCollection) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateForm, editingCollection]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdown]);

  const handleCreateCollection = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!collectionName.trim()) return;

      await createCollection({
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
        color: selectedColor,
      });

      setCollectionName("");
      setCollectionDescription("");
      setSelectedColor("blue");
      setShowCreateForm(false);
    },
    [collectionName, collectionDescription, selectedColor, createCollection],
  );

  const handleUpdateCollection = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCollection || !collectionName.trim()) return;

      await updateCollection(editingCollection.id, {
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
        color: selectedColor,
      });

      setEditingCollection(null);
      setCollectionName("");
      setCollectionDescription("");
      setSelectedColor("blue");
    },
    [
      editingCollection,
      collectionName,
      collectionDescription,
      selectedColor,
      updateCollection,
    ],
  );

  const handleDeleteCollection = useCallback(
    async (collection: BookmarkCollection) => {
      await showDestructiveConfirm(
        {
          title: "Delete Collection",
          message: `Are you sure you want to delete "${collection.name}"? The bookmarks in this collection will not be deleted, but they will be removed from this collection.`,
          confirmButtonLabel: "Delete Collection",
          severity: "warning",
          canUndo: false,
          warningMessage: `This collection contains ${collection.bookmarkCount} bookmark${collection.bookmarkCount !== 1 ? "s" : ""}.`,
        },
        async () => {
          await deleteCollection(collection.id);
          if (selectedCollectionId === collection.id) {
            onSelectCollection(null);
          }
        },
      );
    },
    [
      showDestructiveConfirm,
      deleteCollection,
      selectedCollectionId,
      onSelectCollection,
    ],
  );

  const startEditing = useCallback((collection: BookmarkCollection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || "");
    setSelectedColor(collection.color || "blue");
    setActiveDropdown(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingCollection(null);
    setShowCreateForm(false);
    setCollectionName("");
    setCollectionDescription("");
    setSelectedColor("blue");
  }, []);

  const getCollectionColor = (collection: BookmarkCollection) => {
    const colorOption = COLLECTION_COLORS.find(
      (c) => c.id === collection.color,
    );
    return colorOption?.value || "#3b82f6";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-asph-border-primary px-4 py-3">
        <div className="flex items-center gap-2">
          <Folder size={20} className="text-asph-primary" />
          <h3 className="text-lg font-semibold text-asph-text-primary">
            Collections
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="touch-target-icon rounded-full p-1.5 text-asph-text-secondary transition-colors hover:bg-asph-bg-secondary"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Collection List */}
      <div className="asph-scrollbar flex-1 overflow-y-auto">
        {/* All Bookmarks option */}
        <button
          onClick={() => onSelectCollection(null)}
          className={`touch-target flex w-full items-center gap-3 border-b border-asph-border-primary px-4 py-3 transition-colors hover:bg-asph-bg-secondary ${
            selectedCollectionId === null
              ? "bg-blue-500 bg-opacity-10 text-blue-500"
              : "text-asph-text-primary"
          }`}
        >
          <Folder size={18} />
          <span className="flex-1 text-left font-medium">All Bookmarks</span>
        </button>

        {/* Uncategorized option */}
        <button
          onClick={() => onSelectCollection("__uncategorized__")}
          className={`touch-target flex w-full items-center gap-3 border-b border-asph-border-primary px-4 py-3 transition-colors hover:bg-asph-bg-secondary ${
            selectedCollectionId === "__uncategorized__"
              ? "bg-blue-500 bg-opacity-10 text-blue-500"
              : "text-asph-text-secondary"
          }`}
        >
          <Folder size={18} />
          <span className="flex-1 text-left">Uncategorized</span>
        </button>

        {/* User collections */}
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={`group flex items-center gap-3 border-b border-asph-border-primary px-4 py-3 transition-colors hover:bg-asph-bg-secondary ${
              selectedCollectionId === collection.id
                ? "bg-blue-500 bg-opacity-10"
                : ""
            }`}
          >
            <button
              onClick={() => onSelectCollection(collection.id)}
              className="touch-target-sm flex flex-1 items-center gap-3"
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: getCollectionColor(collection) }}
              />
              <div className="flex-1 text-left">
                <span
                  className={`font-medium ${
                    selectedCollectionId === collection.id
                      ? "text-blue-500"
                      : "text-asph-text-primary"
                  }`}
                >
                  {collection.name}
                </span>
                {collection.description && (
                  <p className="mt-0.5 text-xs text-asph-text-tertiary">
                    {collection.description}
                  </p>
                )}
              </div>
              <span className="text-sm text-asph-text-tertiary">
                {collection.bookmarkCount}
              </span>
            </button>

            {/* Collection menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown(
                    activeDropdown === collection.id ? null : collection.id,
                  );
                }}
                className="touch-target-icon rounded p-1 text-asph-text-tertiary opacity-0 transition-all hover:bg-asph-bg-hover hover:text-asph-text-primary group-hover:opacity-100"
              >
                <MoreVertical size={16} />
              </button>

              {activeDropdown === collection.id && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-32 rounded-lg border border-asph-border-primary bg-asph-bg-primary shadow-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(collection);
                    }}
                    className="touch-target-sm flex w-full items-center gap-2 px-3 py-2 text-sm text-asph-text-primary transition-colors hover:bg-asph-bg-secondary"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(null);
                      handleDeleteCollection(collection);
                    }}
                    disabled={isDeleting}
                    className="touch-target-sm flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {collections.length === 0 && (
          <div className="p-8 text-center">
            <Folder
              size={48}
              className="mx-auto mb-4 text-asph-text-tertiary"
            />
            <p className="text-asph-text-primary">No collections yet</p>
            <p className="mt-2 text-sm text-asph-text-secondary">
              Create a collection to organize your bookmarks
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingCollection) && (
        <div className="border-t border-asph-border-primary p-4">
          <form
            onSubmit={
              editingCollection
                ? handleUpdateCollection
                : handleCreateCollection
            }
          >
            <h4 className="mb-3 font-medium text-asph-text-primary">
              {editingCollection ? "Edit Collection" : "New Collection"}
            </h4>

            <input
              ref={inputRef}
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Collection name"
              className="mb-3 w-full rounded-md border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary focus-visible:border-blue-500 focus-visible:outline-none"
              disabled={isCreating || isUpdating}
            />

            <input
              type="text"
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              placeholder="Description (optional)"
              className="mb-3 w-full rounded-md border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary focus-visible:border-blue-500 focus-visible:outline-none"
              disabled={isCreating || isUpdating}
            />

            <div className="mb-4">
              <p className="mb-2 text-xs text-asph-text-secondary">Color</p>
              <div className="flex gap-2">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColor(color.id)}
                    className={`touch-target h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.id
                        ? "border-asph-text-primary ring-2 ring-blue-500 ring-offset-1"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    disabled={isCreating || isUpdating}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="touch-target-sm flex-1 rounded-md bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-secondary transition-colors hover:bg-asph-bg-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!collectionName.trim() || isCreating || isUpdating}
                className="touch-target-sm flex-1 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                {isCreating || isUpdating
                  ? "Saving..."
                  : editingCollection
                    ? "Save"
                    : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Button */}
      {!showCreateForm && !editingCollection && (
        <div className="border-t border-asph-border-primary p-4">
          <button
            onClick={() => setShowCreateForm(true)}
            className="touch-target-sm flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-asph-border-primary py-2.5 text-sm text-asph-text-secondary transition-colors hover:border-blue-500 hover:text-blue-500"
          >
            <Plus size={16} />
            Create Collection
          </button>
        </div>
      )}
    </div>
  );
};
