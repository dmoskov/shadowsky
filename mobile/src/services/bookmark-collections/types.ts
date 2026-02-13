/**
 * Bookmark Collection Types
 *
 * Collections allow users to organize bookmarks into folders with custom names and descriptions.
 * Collections are stored locally (AsyncStorage) with the bookmark-to-collection mappings.
 */

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  color?: string; // Optional color for visual distinction
  icon?: string; // Optional icon name
  createdAt: string;
  updatedAt: string;
  bookmarkCount: number;
}

export interface BookmarkCollectionMapping {
  bookmarkUri: string;
  collectionId: string;
  addedAt: string;
}

// Default collection that contains all bookmarks not in any specific collection
export const DEFAULT_COLLECTION_ID = "__all__";
export const UNCATEGORIZED_COLLECTION_ID = "__uncategorized__";

// Collection color options
export const COLLECTION_COLORS = [
  { id: "blue", name: "Blue", value: "#3b82f6" },
  { id: "green", name: "Green", value: "#22c55e" },
  { id: "purple", name: "Purple", value: "#a855f7" },
  { id: "pink", name: "Pink", value: "#ec4899" },
  { id: "orange", name: "Orange", value: "#f97316" },
  { id: "yellow", name: "Yellow", value: "#eab308" },
  { id: "red", name: "Red", value: "#ef4444" },
  { id: "teal", name: "Teal", value: "#14b8a6" },
] as const;

// Collection icon options
export const COLLECTION_ICONS = [
  "folder",
  "star",
  "heart",
  "bookmark",
  "tag",
  "flag",
  "lightbulb",
  "code",
  "image",
  "music",
  "film",
  "book",
  "briefcase",
  "coffee",
  "gamepad",
  "palette",
  "sparkles",
  "zap",
] as const;

export type CollectionColor = (typeof COLLECTION_COLORS)[number]["id"];
export type CollectionIcon = (typeof COLLECTION_ICONS)[number];
