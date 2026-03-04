import { Check, ChevronDown, FolderPlus, Plus } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  useBookmarkCollections,
  useBookmarkInCollections,
} from "../../hooks/useBookmarkCollections";
import { useMenuKeyboardNavigation } from "../../hooks/useMenuKeyboardNavigation";
import type { BookmarkCollection } from "../../services/bookmark-collections";
import { COLLECTION_COLORS } from "../../services/bookmark-collections";

interface SaveToCollectionDropdownProps {
  postUri: string;
  onClose?: () => void;
  compact?: boolean;
}

export const SaveToCollectionDropdown: React.FC<
  SaveToCollectionDropdownProps
> = ({ postUri, onClose, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  // Keyboard navigation for dropdown menu (only when not showing form)
  useMenuKeyboardNavigation({
    isOpen: isOpen && !showNewCollectionForm,
    onClose: () => {
      setIsOpen(false);
      onClose?.();
    },
    menuRef,
    triggerRef,
  });

  const {
    collections,
    createCollection,
    addToCollection,
    removeFromCollection,
    isCreating,
  } = useBookmarkCollections();

  const { collectionIds } = useBookmarkInCollections(postUri);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Focus input when showing new collection form
  useEffect(() => {
    if (showNewCollectionForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewCollectionForm]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleToggleCollection = useCallback(
    async (e: React.MouseEvent, collectionId: string) => {
      e.stopPropagation();
      const isInCollection = collectionIds.includes(collectionId);

      if (isInCollection) {
        await removeFromCollection(postUri, collectionId);
      } else {
        await addToCollection(postUri, collectionId);
      }
    },
    [collectionIds, postUri, addToCollection, removeFromCollection],
  );

  const handleCreateCollection = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!newCollectionName.trim()) return;

      const collection = await createCollection({
        name: newCollectionName.trim(),
        color: selectedColor,
      });

      // Add the bookmark to the new collection
      await addToCollection(postUri, collection.id);

      setNewCollectionName("");
      setShowNewCollectionForm(false);
      setSelectedColor("blue");
    },
    [
      newCollectionName,
      selectedColor,
      createCollection,
      addToCollection,
      postUri,
    ],
  );

  const getCollectionColor = (collection: BookmarkCollection) => {
    const colorOption = COLLECTION_COLORS.find(
      (c) => c.id === collection.color,
    );
    return colorOption?.value || "#3b82f6";
  };

  if (compact) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          ref={triggerRef}
          onClick={handleToggle}
          className="touch-target-sm flex items-center gap-1 rounded p-1.5 text-asph-text-secondary transition-colors hover:bg-asph-bg-secondary hover:text-asph-text-primary"
          title="Add to collection"
          aria-label="Add to collection"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
        >
          <FolderPlus size={16} aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Collections"
            className="absolute right-0 top-full z-50 mt-1 min-w-56 rounded-lg border border-asph-border-primary bg-asph-bg-primary shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              <p className="mb-2 px-2 text-xs font-medium text-asph-text-secondary">
                Save to collection
              </p>

              {collections.length === 0 && !showNewCollectionForm && (
                <p className="px-2 py-2 text-sm text-asph-text-tertiary">
                  No collections yet
                </p>
              )}

              {collections.map((collection) => (
                <button
                  key={collection.id}
                  role="menuitem"
                  onClick={(e) => handleToggleCollection(e, collection.id)}
                  className="touch-target-sm flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-asph-text-primary transition-colors hover:bg-asph-bg-secondary focus-visible:bg-asph-bg-secondary focus-visible:outline-none"
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getCollectionColor(collection) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{collection.name}</span>
                  {collectionIds.includes(collection.id) && (
                    <Check
                      size={14}
                      className="text-green-500"
                      aria-label="In collection"
                    />
                  )}
                </button>
              ))}

              {showNewCollectionForm ? (
                <form onSubmit={handleCreateCollection} className="mt-2 px-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    className="mb-2 w-full rounded border border-asph-border-primary bg-asph-bg-secondary px-2 py-1.5 text-sm text-asph-text-primary focus-visible:border-blue-500 focus-visible:outline-none"
                    disabled={isCreating}
                  />
                  <div className="mb-2 flex gap-1">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColor(color.id);
                        }}
                        className={`touch-target h-5 w-5 rounded-full border-2 ${
                          selectedColor === color.id
                            ? "border-asph-text-primary"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNewCollectionForm(false);
                      }}
                      className="touch-target-sm flex-1 rounded bg-asph-bg-secondary px-2 py-1 text-sm text-asph-text-secondary hover:bg-asph-bg-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newCollectionName.trim() || isCreating}
                      className="touch-target-sm flex-1 rounded bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewCollectionForm(true);
                  }}
                  className="touch-target-sm mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-asph-border-primary px-2 py-1.5 text-sm text-asph-text-secondary transition-colors hover:border-blue-500 hover:text-blue-500 focus-visible:border-blue-500 focus-visible:text-blue-500 focus-visible:outline-none"
                >
                  <Plus size={14} aria-hidden="true" />
                  New collection
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="touch-target-sm flex items-center gap-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary px-3 py-1.5 text-sm text-asph-text-primary transition-colors hover:bg-asph-bg-hover"
        aria-label="Add to collection"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <FolderPlus size={16} aria-hidden="true" />
        <span>Add to collection</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Collections"
          className="absolute left-0 top-full z-50 mt-1 min-w-64 rounded-lg border border-asph-border-primary bg-asph-bg-primary shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3">
            <p className="mb-3 text-sm font-medium text-asph-text-primary">
              Collections
            </p>

            {collections.length === 0 && !showNewCollectionForm && (
              <p className="py-4 text-center text-sm text-asph-text-tertiary">
                No collections yet. Create one to get started.
              </p>
            )}

            <div className="asph-scrollbar max-h-60 space-y-1 overflow-y-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  role="menuitem"
                  onClick={(e) => handleToggleCollection(e, collection.id)}
                  className="touch-target-sm flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-asph-bg-secondary focus-visible:bg-asph-bg-secondary focus-visible:outline-none"
                >
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: getCollectionColor(collection) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left text-asph-text-primary">
                    {collection.name}
                  </span>
                  <span
                    className="text-xs text-asph-text-tertiary"
                    aria-hidden="true"
                  >
                    {collection.bookmarkCount}
                  </span>
                  {collectionIds.includes(collection.id) && (
                    <Check
                      size={16}
                      className="text-green-500"
                      aria-label="In collection"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-asph-border-primary pt-3">
              {showNewCollectionForm ? (
                <form onSubmit={handleCreateCollection}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    className="mb-3 w-full rounded-md border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-primary focus-visible:border-blue-500 focus-visible:outline-none"
                    disabled={isCreating}
                  />
                  <div className="mb-3 flex gap-2">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColor(color.id);
                        }}
                        className={`touch-target h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          selectedColor === color.id
                            ? "border-asph-text-primary ring-2 ring-blue-500 ring-offset-1"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNewCollectionForm(false);
                        setNewCollectionName("");
                      }}
                      className="touch-target-sm flex-1 rounded-md bg-asph-bg-secondary px-3 py-2 text-sm text-asph-text-secondary transition-colors hover:bg-asph-bg-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newCollectionName.trim() || isCreating}
                      className="touch-target-sm flex-1 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isCreating ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewCollectionForm(true);
                  }}
                  className="touch-target-sm flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-asph-border-primary py-2 text-sm text-asph-text-secondary transition-colors hover:border-blue-500 hover:text-blue-500 focus-visible:border-blue-500 focus-visible:text-blue-500 focus-visible:outline-none"
                >
                  <Plus size={16} aria-hidden="true" />
                  New collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
