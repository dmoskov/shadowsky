import { X } from "lucide-react";
import React, { useState } from "react";
import { List } from "../types/lists";

interface EditListModalProps {
  list: List;
  onClose: () => void;
  onUpdate: (
    listId: string,
    updates: { name?: string; description?: string },
  ) => Promise<void>;
}

export const EditListModal: React.FC<EditListModalProps> = ({
  list,
  onClose,
  onUpdate,
}) => {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("List name is required");
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      await onUpdate(list.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } catch (error) {
      setError("Failed to update list. Please try again.");
      console.error("Failed to update list:", error);
    } finally {
      setIsUpdating(false);
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
            Edit List
          </h3>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-200 hover:bg-bsky-bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label
              htmlFor="edit-list-name"
              className="mb-2 block text-sm font-medium text-bsky-text-primary"
            >
              Name
            </label>
            <input
              id="edit-list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome list"
              maxLength={50}
              className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
              autoFocus
            />
            <div className="mt-1 text-right text-xs text-bsky-text-tertiary">
              {name.length}/50
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="edit-list-description"
              className="mb-2 block text-sm font-medium text-bsky-text-primary"
            >
              Description (optional)
            </label>
            <textarea
              id="edit-list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              maxLength={200}
              rows={3}
              className="w-full resize-none rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
            />
            <div className="mt-1 text-right text-xs text-bsky-text-tertiary">
              {description.length}/200
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-bsky-border-primary bg-transparent px-4 py-2 text-sm font-medium text-bsky-text-primary transition-all duration-200 hover:bg-bsky-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating || !name.trim()}
              className="cursor-pointer rounded-lg border-none bg-bsky-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
