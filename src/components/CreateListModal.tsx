import { X } from "lucide-react";
import React, { useState } from "react";

interface CreateListModalProps {
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}

export const CreateListModal: React.FC<CreateListModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("List name is required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      await onCreate(name.trim(), description.trim() || undefined);
    } catch (error) {
      setError("Failed to create list. Please try again.");
      console.error("Failed to create list:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-auto-height modal-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-asph-border-primary p-6">
          <h3 className="m-0 text-lg font-semibold text-asph-text-primary">
            Create New List
          </h3>
          <button
            onClick={onClose}
            className="touch-target-icon cursor-pointer rounded-md border-none bg-transparent p-2 text-asph-text-secondary transition-all duration-200 hover:bg-asph-bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label
              htmlFor="list-name"
              className="mb-2 block text-sm font-medium text-asph-text-primary"
            >
              Name
            </label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome list"
              maxLength={50}
              className="w-full rounded-lg border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 text-asph-text-primary focus-visible:border-asph-primary focus-visible:outline-none"
              autoFocus
            />
            <div className="mt-1 text-right text-xs text-asph-text-tertiary">
              {name.length}/50
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="list-description"
              className="mb-2 block text-sm font-medium text-asph-text-primary"
            >
              Description (optional)
            </label>
            <textarea
              id="list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              maxLength={200}
              rows={3}
              className="w-full resize-none rounded-lg border border-asph-border-primary bg-asph-bg-secondary px-3 py-2 text-asph-text-primary focus-visible:border-asph-primary focus-visible:outline-none"
            />
            <div className="mt-1 text-right text-xs text-asph-text-tertiary">
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
              className="touch-target-sm cursor-pointer rounded-lg border border-asph-border-primary bg-transparent px-4 py-2 text-sm font-medium text-asph-text-primary transition-all duration-200 hover:bg-asph-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="touch-target-sm cursor-pointer rounded-lg border-none bg-asph-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create List"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
