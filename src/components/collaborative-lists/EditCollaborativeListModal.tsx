import { X } from "lucide-react";
import React, { useState } from "react";
import {
  CollaborativeList,
  ListVisibility,
  UpdateCollaborativeListRequest,
} from "../../types/collaborative-list";

interface EditCollaborativeListModalProps {
  list: CollaborativeList;
  onClose: () => void;
  onUpdate: (
    listId: string,
    updates: UpdateCollaborativeListRequest,
  ) => Promise<void>;
}

export const EditCollaborativeListModal: React.FC<
  EditCollaborativeListModalProps
> = ({ list, onClose, onUpdate }) => {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description || "");
  const [visibility, setVisibility] = useState<ListVisibility>(list.visibility);
  const [tags, setTags] = useState(list.tags?.join(", ") || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("List name is required");
      return;
    }

    if (name.trim().length < 3) {
      setError("List name must be at least 3 characters");
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await onUpdate(list.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        tags: tagList.length > 0 ? tagList : undefined,
      });

      onClose();
    } catch (err) {
      setError("Failed to update list. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-bsky-bg-primary shadow-xl"
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
          {/* Name */}
          <div className="mb-4">
            <label
              htmlFor="list-name"
              className="mb-2 block text-sm font-medium text-bsky-text-primary"
            >
              Name *
            </label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Top AI Researchers to Follow"
              maxLength={64}
              className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
              autoFocus
            />
            <div className="mt-1 text-right text-xs text-bsky-text-tertiary">
              {name.length}/64
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="list-description"
              className="mb-2 block text-sm font-medium text-bsky-text-primary"
            >
              Description
            </label>
            <textarea
              id="list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              maxLength={300}
              rows={3}
              className="w-full resize-none rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
            />
            <div className="mt-1 text-right text-xs text-bsky-text-tertiary">
              {description.length}/300
            </div>
          </div>

          {/* Visibility */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-bsky-text-primary">
              Visibility
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex-1 cursor-pointer rounded-lg border px-4 py-2 text-center transition-all duration-200 ${
                  visibility === "public"
                    ? "border-bsky-primary bg-bsky-primary text-white"
                    : "hover:border-bsky-primary/50 border-bsky-border-primary bg-bsky-bg-secondary text-bsky-text-primary"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`flex-1 cursor-pointer rounded-lg border px-4 py-2 text-center transition-all duration-200 ${
                  visibility === "private"
                    ? "border-bsky-primary bg-bsky-primary text-white"
                    : "hover:border-bsky-primary/50 border-bsky-border-primary bg-bsky-bg-secondary text-bsky-text-primary"
                }`}
              >
                Private
              </button>
            </div>
            <p className="mt-1 text-xs text-bsky-text-tertiary">
              {visibility === "public"
                ? "Anyone can discover and follow this list"
                : "Only you and collaborators can see this list"}
            </p>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label
              htmlFor="list-tags"
              className="mb-2 block text-sm font-medium text-bsky-text-primary"
            >
              Tags (comma-separated)
            </label>
            <input
              id="list-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ai, research, tech"
              className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-3 py-2 text-bsky-text-primary focus:border-bsky-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-bsky-text-tertiary">
              Tags help others discover your list
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
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
